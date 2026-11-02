import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, Maximize2, Minimize2, LocateFixed, Pencil, X } from 'lucide-react';
import type { Person, Island, PersonCategory } from '../types';
import { useStore, touchRecord } from '../state/store';
import {
  displayCategories, shortLabel, displayName, personChainRank, categoryColor, currentIslandId, livesAway,
} from '../lib/personDisplay';
import Modal from './Modal';
import Badge from './Badge';
import { MAP_PATHS, MAP_W, MAP_H, ATOLLS, ATOLL_ANCHORS, islandAtoll, islandPoint, THAA_LAGOON, THAA_REEFS, THAA_ISLANDS } from '../lib/maldivesMap';

const W = 360;
const H = 360;
const MIN_K = 0.6;
const MAX_K_NET = 6;
const MAX_K_MAP = 140;
// Map view: the whole country fits the 360-unit canvas height
const MS = (H - 20) / MAP_H;
const MX0 = W / 2 - (MAP_W * MS) / 2 - 20;
const MY0 = 10;
const toWorld = (mx: number, my: number) => ({ x: MX0 + mx * MS, y: MY0 + my * MS });
const ALL_CATEGORIES: PersonCategory[] = ['Dealer', 'Street Dealer', 'Carrier', 'Drug User', 'Theft', 'Person of Interest'];
const RED = '#e0362e';
const ORANGE = '#e0a53d';
const PURPLE = '#a259d9'; // links between different islands

interface Node { p: Person; x: number; y: number; outside?: boolean; r?: number }
interface Bubble { iid: string; x: number; y: number; r: number; main?: boolean }
interface PairLink { a: string; b: string; count: number }
interface Marker { iid: string; x: number; y: number; count: number; dealers: number; users: number; exact: boolean }
interface Edge { a: string; b: string; from?: string; to?: string; color: string; cross: boolean }
interface View { x: number; y: number; k: number }

const NetworkMap: React.FC<{ persons: Person[]; islands: Island[]; islandId: string; onOpenIsland?: (id: string) => void }> = ({ persons, islands, islandId, onOpenIsland }) => {
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [selIsland, setSelIsland] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<'network' | 'map'>('network');
  const [linkFilter, setLinkFilter] = useState<'all' | 'same' | 'other'>('all');
  const isMap = mode === 'map';
  const MAX_K = isMap ? MAX_K_MAP : MAX_K_NET;
  // Dot size: fixed in Network view; constant on-screen size in Map view so zooming spreads people apart
  const nodeR = isMap ? 4.6 / view.k : 11;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [box, setBox] = useState({ w: W, h: H });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; dist: number; k: number } | null>(null);

  const islandName = (id: string) => islands.find((i) => i.id === id)?.name ?? '';

  // ---------- layout ----------
  const { nodes, edges, bubbles, pairs, markers, mapPairs } = useMemo(() => {
    const byId = new Map(persons.map((p) => [p.id, p]));
    const rankSort = (a: Person, b: Person) => (personChainRank(a) ?? 9) - (personChainRank(b) ?? 9);
    const out: Node[] = [];
    const bubbles: Bubble[] = [];
    const markers: Marker[] = [];
    const mapPairs: PairLink[] = [];
    if (isMap) {
      // Group by atoll -> island (present island), place around the atoll's point on the map
      const islandById = new Map(islands.map((i) => [i.id, i]));
      const byAtoll = new Map<string, Map<string, Person[]>>();
      persons.forEach((p) => {
        const iid = currentIslandId(p);
        const atoll = islandAtoll(islandById.get(iid)) ?? '_none';
        if (!byAtoll.has(atoll)) byAtoll.set(atoll, new Map());
        const m = byAtoll.get(atoll)!;
        if (!m.has(iid)) m.set(iid, []);
        m.get(iid)!.push(p);
      });
      byAtoll.forEach((isles, atoll) => {
        const [ax, ay] = atoll === '_none' ? [MAP_W + 70, 480] : ATOLL_ANCHORS[atoll as keyof typeof ATOLL_ANCHORS];
        const all = [...isles.entries()];
        // Islands with a known position (Thaa) sit exactly there; others share a ring around the atoll point
        const exact = all.filter(([iid]) => islandPoint(islandById.get(iid)));
        const list = all.filter(([iid]) => !islandPoint(islandById.get(iid)));
        const mark = (iid: string, ppl: Person[], mx: number, my: number, exact: boolean) => {
          const w = toWorld(mx, my);
          const has = (p: Person, cs: string[]) => displayCategories(p).some((c) => cs.includes(c));
          markers.push({
            iid, x: w.x, y: w.y, count: ppl.length, exact,
            dealers: ppl.filter((p) => has(p, ['Dealer', 'Street Dealer'])).length,
            users: ppl.filter((p) => has(p, ['Drug User'])).length,
          });
        };
        exact.forEach(([iid, ppl]) => { const [ix, iy] = islandPoint(islandById.get(iid))!; mark(iid, ppl, ix, iy, true); });
        const ringR = list.length > 1 ? 8 + list.length * 3 : 0;
        list.forEach(([iid, ppl], ii) => {
          const a = (ii / list.length) * Math.PI * 2 - Math.PI / 2;
          mark(iid, ppl, ax + Math.cos(a) * ringR, ay + Math.sin(a) * ringR, false);
        });
      });
      // One line per pair of linked islands
      const seenP = new Set<string>();
      const pmap = new Map<string, PairLink>();
      persons.forEach((p) => (p.linkedPersonIds ?? []).forEach((tid) => {
        const t = byId.get(tid);
        if (!t || tid === p.id) return;
        const key = [p.id, tid].sort().join('|');
        if (seenP.has(key)) return;
        seenP.add(key);
        const ia = currentIslandId(p), ib = currentIslandId(t);
        if (ia === ib) return;
        const k2 = [ia, ib].sort().join('|');
        const cur = pmap.get(k2) ?? { a: ia, b: ib, count: 0 };
        cur.count += 1; pmap.set(k2, cur);
      }));
      mapPairs.push(...pmap.values());
    } else {
      // Island bubbles: each island's people sit inside its own circle
      const byIsland = new Map<string, Person[]>();
      persons.forEach((p) => {
        const iid = currentIslandId(p);
        if (!byIsland.has(iid)) byIsland.set(iid, []);
        byIsland.get(iid)!.push(p);
      });
      const fill = (iid: string, list: Person[], cx: number, cy: number, rb: number, main?: boolean) => {
        bubbles.push({ iid, x: cx, y: cy, r: rb, main });
        const sorted = [...list].sort(rankSort);
        const n = sorted.length;
        const rr = n > 1 ? rb * 0.62 : 0;
        const dot = Math.max(3.5, Math.min(11, rb * 0.24, n > 1 ? ((2 * Math.PI * rr) / n) * 0.3 : 11));
        sorted.forEach((p, i) => {
          const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
          out.push({ p, x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr, r: dot });
        });
      };
      if (islandId) {
        // Chosen island in the middle; only islands it is connected to around it
        const here = byIsland.get(islandId) ?? [];
        const ids = new Set(here.map((p) => p.id));
        const ext = new Set<string>();
        persons.forEach((p) => { if (!ids.has(p.id) && p.islandId === islandId) ext.add(p.id); }); // from here, living elsewhere
        here.forEach((p) => (p.linkedPersonIds ?? []).forEach((id) => { if (!ids.has(id) && byId.has(id)) ext.add(id); }));
        persons.forEach((p) => { if (!ids.has(p.id) && (p.linkedPersonIds ?? []).some((id) => ids.has(id))) ext.add(p.id); });
        const others = new Map<string, Person[]>();
        ext.forEach((id) => {
          const p = byId.get(id)!; const iid = currentIslandId(p);
          if (!others.has(iid)) others.set(iid, []);
          others.get(iid)!.push(p);
        });
        const ol = [...others.entries()];
        fill(islandId, here, W / 2 - 14, H / 2 + 12, ol.length ? 88 : 125, true);
        ol.forEach(([iid, list], i) => {
          const ang = (i / ol.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / Math.max(ol.length, 2); // half-step rotation keeps the top-left clear
          const rb = Math.min(40, 18 + list.length * 5, ol.length > 6 ? 30 : 40);
          fill(iid, list, W / 2 - 14 + Math.cos(ang) * 132, H / 2 + 12 + Math.sin(ang) * 132, rb);
        });
      } else {
        // Grid of island bubbles, biggest islands first
        const groups = [...byIsland.entries()].sort((x, y) => y[1].length - x[1].length);
        const g = groups.length;
        const cols = Math.max(1, Math.ceil(Math.sqrt(g)));
        const rows = Math.max(1, Math.ceil(g / cols));
        // keep clear of the view switch (top) and zoom buttons (right)
        const AX = 6, AY = 46, AW = W - 6 - 52, AH = H - AY - 6;
        const cell = Math.min(AW / cols, AH / rows);
        const maxN = Math.max(1, ...groups.map(([, l]) => l.length));
        const ox = AX + (AW - cols * cell) / 2, oy = AY + (AH - rows * cell) / 2;
        groups.forEach(([iid, list], i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const rb = cell * 0.4 * (0.62 + 0.38 * Math.sqrt(list.length / maxN));
          fill(iid, list, ox + (c + 0.5) * cell, oy + (r + 0.5) * cell, rb);
        });
      }
    }
    const pos = new Map(out.map((n) => [n.p.id, n]));
    const seen = new Set<string>();
    const es: Edge[] = [];
    out.forEach(({ p }) => (p.linkedPersonIds ?? []).forEach((tid) => {
      const t = pos.get(tid);
      if (!t || tid === p.id) return;
      const key = [p.id, tid].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const ra = personChainRank(p), rb = personChainRank(t.p);
      let from: string | undefined, to: string | undefined, color = '#8a8f98';
      if (ra !== null && rb !== null && ra !== rb) {
        const aUp = ra < rb;
        from = aUp ? p.id : tid; to = aUp ? tid : p.id;
        color = Math.min(ra, rb) === 0 ? RED : ORANGE;
      }
      es.push({ a: p.id, b: tid, from, to, color, cross: currentIslandId(p) !== currentIslandId(t.p) });
    }));
    // Links between islands, counted per island pair (drawn as one line between bubbles)
    const pm = new Map<string, PairLink>();
    es.forEach((e) => {
      if (!e.cross) return;
      const ia = currentIslandId(pos.get(e.a)!.p), ib = currentIslandId(pos.get(e.b)!.p);
      const key = [ia, ib].sort().join('|');
      const cur = pm.get(key) ?? { a: ia, b: ib, count: 0 };
      cur.count += 1; pm.set(key, cur);
    });
    return { nodes: out, edges: es, bubbles, pairs: [...pm.values()], markers, mapPairs };
  }, [persons, islands, islandId, isMap]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.p.id, n])), [nodes]);
  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    edges.forEach((e) => { if (e.a === selected) s.add(e.b); if (e.b === selected) s.add(e.a); });
    return s;
  }, [edges, selected]);

  useEffect(() => { if (selected && !nodeMap.has(selected)) setSelected(null); }, [nodeMap, selected]);
  // Starting view: in Map view zoom to the chosen island's people, else show everything
  const homeView = (): View => {
    if (isMap && islandId) {
      const m = markers.find((mk) => mk.iid === islandId);
      if (m) { const k = m.exact ? 40 : 14; return { k, x: W / 2 - m.x * k, y: H / 2 - m.y * k }; }
      const isl = islands.find((i) => i.id === islandId);
      const at = islandAtoll(isl);
      if (at) { const w = toWorld(...ATOLL_ANCHORS[at]); const k = 8; return { k, x: W / 2 - w.x * k, y: H / 2 - w.y * k }; }
    }
    return { x: 0, y: 0, k: 1 };
  };
  useEffect(() => { setView(homeView()); setSelected(null); setSelIsland(null); }, [islandId, isMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- zoom / pan ----------
  const unit = () => {
    const r = svgRef.current!.getBoundingClientRect();
    return { r, s: W / Math.min(r.width, r.height) };
  };
  const toView = (cx: number, cy: number) => {
    const { r, s } = unit();
    return { x: (cx - r.left - r.width / 2) * s + W / 2, y: (cy - r.top - r.height / 2) * s + H / 2 };
  };
  const zoomAt = (factor: number, fx = W / 2, fy = H / 2) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const f = k / v.k;
      return { k, x: fx - (fx - v.x) * f, y: fy - (fy - v.y) * f };
    });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = toView(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, f.x, f.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      moved: 0, k: view.k,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const pts = [...pointers.current.values()];
    const { s } = unit();
    if (pts.length === 1) {
      const dx = (cur.x - prev.x) * s, dy = (cur.y - prev.y) * s;
      gesture.current.moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gesture.current.moved += 10;
      if (gesture.current.dist > 0) {
        const mid = toView((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        zoomAt(d / gesture.current.dist, mid.x, mid.y);
      }
      gesture.current.dist = d;
    }
  };
  // Taps are detected here rather than with onClick: while the map holds the
  // touch (for panning), some browsers send the click to the map itself
  // instead of the dot under the finger.
  const onUp = (e: React.PointerEvent) => {
    const wasTap = pointers.current.size === 1 && !!gesture.current && gesture.current.moved < 8;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    if (wasTap && e.type === 'pointerup') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isle = el?.closest('[data-iid]');
      if (isle) { setSelIsland(isle.getAttribute('data-iid')); setSelected(null); return; }
      const hit = el?.closest('[data-pid]');
      setSelected(hit ? hit.getAttribute('data-pid') : null);
      setSelIsland(null);
    }
  };

  const reset = () => setView(homeView());
  const focusSelected = () => {
    const n = selected ? nodeMap.get(selected) : null;
    if (!n) return;
    const k = isMap ? Math.max(view.k, 60) : 2.2;
    setView({ k, x: W / 2 - n.x * k, y: H / 2 - n.y * k });
  };

  const sel = selected ? nodeMap.get(selected)?.p ?? null : null;
  const linkShown = (e: Edge) => (linkFilter === 'same' ? !e.cross : linkFilter === 'other' ? e.cross : true);
  // All-islands Network view: links between islands are bundled into one line per island pair,
  // except the tapped person's own links, which are drawn person to person.
  const bundled = !isMap && !islandId;
  const bubbleOf = useMemo(() => new Map(bubbles.map((b) => [b.iid, b])), [bubbles]);
  const dim = (id: string) => !!selected && id !== selected && !neighbours.has(id);

  const canvas = (
    <div className={full ? 'net-full' : 'net-wrap'}>
      <div style={{ position: 'relative', width: '100%', height: full ? '100%' : undefined, maxWidth: full ? undefined : 480, aspectRatio: full ? undefined : '1 / 1', margin: '0 auto' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', display: 'block', userSelect: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <defs>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={RED} />
          </marker>
 <marker id="arrow-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={PURPLE} />
          </marker>
          <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={ORANGE} />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {isMap && (
            <g style={{ pointerEvents: 'none' }}>
              <g transform={`translate(${MX0} ${MY0}) scale(${MS})`}>
                {MAP_PATHS.map((d, i) => <path key={i} d={d} fill="var(--map-land)" stroke="var(--map-edge)" strokeWidth={1.2 / view.k / MS * 0.5} />)}
                {/* Thaa Atoll in detail: lagoon, reef rim, inhabited islands */}
                <path d={THAA_LAGOON} fill="var(--map-lagoon)" />
                {THAA_REEFS.map((d, i) => <path key={'r' + i} d={d} fill="var(--map-reef)" />)}
                {Object.entries(THAA_ISLANDS).map(([n, [x, y]]) => (
                  <circle key={n} cx={x} cy={y} r={Math.max(0.18, 2.2 / view.k / MS)} fill="var(--map-island)" />
                ))}
              </g>
            </g>
          )}
          {isMap && linkFilter !== 'same' && mapPairs.map((pl) => {
            const A = markers.find((m) => m.iid === pl.a), B = markers.find((m) => m.iid === pl.b);
            if (!A || !B) return null;
            const focus = selIsland ?? islandId;
            const hot = !!focus && (pl.a === focus || pl.b === focus);
            return (
              <line key={'mp' + pl.a + pl.b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={PURPLE}
                strokeWidth={(1.4 + Math.min(pl.count, 6) * 0.55) / view.k} strokeDasharray={`${5 / view.k} ${3 / view.k}`} strokeLinecap="round"
                opacity={focus && !hot ? 0.15 : 0.85} style={{ pointerEvents: 'none' }} />
            );
          })}
          {isMap && markers.map((m) => {
            const r = (8 + Math.min(m.count, 40) * 0.28) / view.k;
            const on = m.iid === selIsland || m.iid === islandId;
            const focus = selIsland ?? islandId;
            const linked = !focus || on || mapPairs.some((pl) => (pl.a === focus && pl.b === m.iid) || (pl.b === focus && pl.a === m.iid));
            return (
              <g key={'mk' + m.iid} data-iid={m.iid} style={{ cursor: 'pointer' }} opacity={linked ? 1 : 0.35}>
                <circle cx={m.x} cy={m.y} r={r + 8 / view.k} fill="transparent" />
                {on && <circle cx={m.x} cy={m.y} r={r + 3.5 / view.k} fill="none" stroke="var(--accent)" strokeWidth={2.2 / view.k} />}
                <circle cx={m.x} cy={m.y} r={r} fill={m.dealers ? RED : 'var(--accent)'} stroke="#fff" strokeWidth={1.6 / view.k} />
              </g>
            );
          })}
          {!isMap && bubbles.map((b) => (
            <circle key={'b' + b.iid} cx={b.x} cy={b.y} r={b.r} fill="var(--bubble)" stroke={b.main ? 'var(--accent)' : 'var(--bubble-edge)'}
              strokeWidth={b.main ? 1.6 : 1} style={{ pointerEvents: 'none' }} />
          ))}
          {bundled && linkFilter !== 'same' && pairs.map((pl) => {
            const A = bubbleOf.get(pl.a), B = bubbleOf.get(pl.b);
            if (!A || !B) return null;
            const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
            const x1 = A.x + (dx / len) * A.r, y1 = A.y + (dy / len) * A.r;
            const x2 = B.x - (dx / len) * B.r, y2 = B.y - (dy / len) * B.r;
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            const faded = !!selected;
            return (
              <g key={'pl' + pl.a + pl.b} opacity={faded ? 0.15 : 0.9} style={{ pointerEvents: 'none' }}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PURPLE} strokeWidth={1.4 + Math.min(pl.count, 6) * 0.6} strokeDasharray="5 3" strokeLinecap="round" />
                <circle cx={mx} cy={my} r={7} fill={PURPLE} />
                <text x={mx} y={my + 3.2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">{pl.count}</text>
              </g>
            );
          })}
          {edges.map((e, i) => {
            if (!linkShown(e)) return null;
            const hotE = !!selected && (e.a === selected || e.b === selected);
            if (bundled && e.cross && !hotE) return null;
            const A = nodeMap.get(e.from ?? e.a)!, B = nodeMap.get(e.to ?? e.b)!;
            const rB = isMap ? nodeR : (B.r ?? 11);
            let x2 = B.x, y2 = B.y;
            if (e.from) {
              const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
              x2 = B.x - (dx / len) * (rB + 1); y2 = B.y - (dy / len) * (rB + 1);
            }
            const hot = !!selected && (e.a === selected || e.b === selected);
            const faded = !!selected && !hot;
            return (
              <line key={i} x1={A.x} y1={A.y} x2={x2} y2={y2} stroke={e.cross ? PURPLE : e.color}
                strokeWidth={isMap ? (hot ? 2 : 1.1) / view.k : (hot ? 3 : 1.8) / Math.sqrt(view.k)}
                strokeDasharray={e.cross || !e.from ? (isMap ? `${4 / view.k} ${2 / view.k}` : '6 3') : undefined}
                opacity={faded ? 0.12 : 0.9}
                markerEnd={e.from ? (e.cross ? 'url(#arrow-purple)' : e.color === RED ? 'url(#arrow-red)' : 'url(#arrow-orange)') : undefined} />
            );
          })}
          {nodes.map(({ p, x, y, outside, r }) => {
            const cats = displayCategories(p);
            const R = isMap ? nodeR : (r ?? 11);
            const u = isMap ? 1 / view.k : 1; // ring and outline thickness
            const isSel = p.id === selected;
            return (
              <g key={p.id} data-pid={p.id} opacity={dim(p.id) ? 0.2 : 1} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={R + 8 * u} fill="transparent" />
                {outside && <circle cx={x} cy={y} r={R + 3 * u} fill="none" stroke={ORANGE} strokeDasharray={`${3 * u} ${2 * u}`} strokeWidth={1.5 * u} />}
                {!outside && livesAway(p) && <circle cx={x} cy={y} r={R + 3 * u} fill="none" stroke="var(--ok)" strokeWidth={1.8 * u} />}
                {isSel && <circle cx={x} cy={y} r={R + 5 * u} fill="none" stroke="var(--accent)" strokeWidth={2.5 * u} />}
                {cats.length <= 1 ? (
                  <circle cx={x} cy={y} r={R} fill={cats[0] ? categoryColor(cats[0]) : 'var(--text-dim)'} stroke="var(--card)" strokeWidth={1.5 * u} />
                ) : cats.map((c, i) => {
                  const a0 = (i / cats.length) * Math.PI * 2 - Math.PI / 2;
                  const a1 = ((i + 1) / cats.length) * Math.PI * 2 - Math.PI / 2;
                  const large = a1 - a0 > Math.PI ? 1 : 0;
                  return (
                    <path key={c} fill={categoryColor(c)} stroke="var(--card)" strokeWidth={u}
                      d={`M${x} ${y} L${x + R * Math.cos(a0)} ${y + R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${x + R * Math.cos(a1)} ${y + R * Math.sin(a1)} Z`} />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
      {/* Names are normal HTML text (same rendering as the Persons list) so
          Dhivehi right-to-left script displays correctly on iPhone. */}
      <div className="net-labels" aria-hidden="true">
        {isMap && (() => {
          // Map labels as HTML too: tiny SVG text scaled up renders distorted on phones
          const sc = Math.min(box.w, box.h) / W;
          const ox = (box.w - W * sc) / 2, oy = (box.h - H * sc) / 2;
          const at = (wx: number, wy: number) => ({ x: ox + (view.x + wx * view.k) * sc, y: oy + (view.y + wy * view.k) * sc });
          const inView = (q: { x: number; y: number }) => q.x > -120 && q.x < box.w + 120 && q.y > -20 && q.y < box.h + 20;
          const out: React.ReactNode[] = [];
          ATOLLS.forEach((a) => {
            const left = ATOLL_ANCHORS[a.code][0] < MAP_W * 0.55;
            const w = toWorld(...ATOLL_ANCHORS[a.code]);
            const q = at(w.x + (left ? -1 : 1) * 14 * MS, w.y);
            if (a.code === 'Th' && view.k > 5) return; // Thaa shows island names instead
            if (inView(q)) out.push(
              <div key={'a' + a.code} className={`map-label atoll ${left ? 'left' : ''}`} style={{ left: q.x + (left ? -6 : 6), top: q.y }}>
                {view.k > 3 ? a.name : a.code}
              </div>,
            );
          });
          if (view.k > 5) Object.entries(THAA_ISLANDS).forEach(([n, [mx, my]]) => {
            const left = mx < ATOLL_ANCHORS.Th[0];
            const w = toWorld(mx, my);
            const q = at(w.x, w.y);
            if (inView(q)) out.push(
              <div key={'i' + n} className={`map-label island ${left ? 'left' : ''}`} style={{ left: q.x + (left ? -7 : 7), top: q.y - 9 }}>{n}</div>,
            );
          });
          markers.forEach((m) => {
            const q = at(m.x, m.y);
            if (!inView(q)) return;
            const r = 8 + Math.min(m.count, 40) * 0.28;
            out.push(<div key={'mc' + m.iid} className="marker-count" style={{ left: q.x, top: q.y }}>{m.count}</div>);
            if (!m.exact) out.push( // Thaa islands are already named on the map when zoomed in
              <div key={'mn' + m.iid} dir="auto" className="marker-name" style={{ left: q.x, top: q.y + r * sc + 2 }}>{islandName(m.iid)}</div>,
            );
          });
          if (linkFilter !== 'same') mapPairs.forEach((pl) => {
            const A = markers.find((m) => m.iid === pl.a), B = markers.find((m) => m.iid === pl.b);
            if (!A || !B) return;
            const q = at((A.x + B.x) / 2, (A.y + B.y) / 2);
            const pa = at(A.x, A.y), pb = at(B.x, B.y);
            if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 48) return; // too short to label without covering the markers
            if (inView(q)) out.push(<div key={'pc' + pl.a + pl.b} className="pair-count" style={{ left: q.x, top: q.y }}>{pl.count}</div>);
          });
          if (markers.some((m) => islandAtoll(islands.find((i) => i.id === m.iid)) === undefined)) {
            const w = toWorld(MAP_W + 70, 455);
            const q = at(w.x, w.y);
            if (inView(q)) out.push(<div key="none" className="map-label none" style={{ left: q.x, top: q.y }}>Atoll not set</div>);
          }
          return out;
        })()}
        {!isMap && (() => {
          const sc = Math.min(box.w, box.h) / W;
          const ox = (box.w - W * sc) / 2, oy = (box.h - H * sc) / 2;
          return bubbles.map((b) => {
            const sx = ox + (view.x + b.x * view.k) * sc;
            const sy = oy + (view.y + (b.y - b.r) * view.k) * sc - 3;
            const count = nodes.filter((n) => currentIslandId(n.p) === b.iid).length;
            return (
              <div key={'bl' + b.iid} dir="auto" className={`bubble-label ${b.main ? 'main' : ''}`} style={{ left: sx, top: sy }}>
                {islandName(b.iid) || 'Unknown island'} <span>{count}</span>
              </div>
            );
          });
        })()}
        {(() => {
          const sc = Math.min(box.w, box.h) / W;
          const ox = (box.w - W * sc) / 2, oy = (box.h - H * sc) / 2;
          return nodes.map(({ p, x, y, r }) => {
            const rr = isMap ? nodeR : (r ?? 11);
            const fs = isMap ? 12 : Math.max(10, Math.min(16, rr * 1.15 * Math.sqrt(view.k) * sc));
            // Small dots (crowded islands): names appear once zoomed in, or for the tapped person and their links
            if (!isMap && rr * view.k * sc < 6 && p.id !== selected && !neighbours.has(p.id)) return null;
            // Map view: names appear once zoomed in (always for the selected person and their links)
            if (isMap && view.k < 7 && p.id !== selected && !neighbours.has(p.id)) return null;
            const sx = ox + (view.x + x * view.k) * sc;
            const sy = oy + (view.y + y * view.k) * sc + rr * view.k * sc + 2;
            if (sx < -60 || sx > box.w + 60 || sy < -20 || sy > box.h + 20) return null;
            return (
              <div key={p.id} dir="auto" className="net-label"
                style={{ left: sx, top: sy, fontSize: fs, opacity: dim(p.id) ? 0.2 : 1, fontWeight: p.id === selected ? 700 : 600 }}>
                {shortLabel(p)}
              </div>
            );
          });
        })()}
      </div>
      </div>

      <div className="net-mode" role="tablist" aria-label="View">
        <button role="tab" aria-selected={!isMap} className={!isMap ? 'on' : ''} onClick={() => setMode('network')}>Network</button>
        <button role="tab" aria-selected={isMap} className={isMap ? 'on' : ''} onClick={() => setMode('map')}>Map</button>
      </div>

      <div className="net-ctrl">
        <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomAt(1.4)}><Plus size={18} /></button>
        <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)}><Minus size={18} /></button>
        <button className="icon-btn" aria-label="Reset view" onClick={reset}><LocateFixed size={18} /></button>
        <button className="icon-btn" aria-label={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull((f) => !f)}>
          {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {isMap && selIsland && (() => {
        const m = markers.find((mk) => mk.iid === selIsland);
        if (!m) return null;
        const links = mapPairs.filter((pl) => pl.a === m.iid || pl.b === m.iid);
        return (
          <div className="net-sheet">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div dir="auto" style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{islandName(m.iid)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {m.count} {m.count === 1 ? 'person' : 'people'} · {m.dealers} dealer{m.dealers === 1 ? '' : 's'} · {m.users} user{m.users === 1 ? '' : 's'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {links.length ? `Linked to ${links.length} island${links.length === 1 ? '' : 's'} (${links.reduce((t, l) => t + l.count, 0)} links)` : 'No links to other islands'}
              </div>
            </div>
            {onOpenIsland && <button className="btn btn-primary" onClick={() => { onOpenIsland(m.iid); setMode('network'); }}>Open network</button>}
            <button className="icon-btn" aria-label="Close" onClick={() => setSelIsland(null)}><X size={16} /></button>
          </div>
        );
      })()}
      {sel && (
        <div className="net-sheet">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(sel)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {livesAway(sel) ? `${islandName(sel.islandId)} → ${islandName(sel.presentIslandId!)}` : islandName(sel.islandId)} · {neighbours.size} connection{neighbours.size === 1 ? '' : 's'}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {displayCategories(sel).map((c) => <Badge key={c} text={c} />)}
            </div>
          </div>
          <button className="btn" onClick={focusSelected}>Focus</button>
          <button className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>
          <button className="icon-btn" aria-label="Clear selection" onClick={() => setSelected(null)}><X size={16} /></button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {full ? createPortal(<div className="net-full-overlay">{canvas}</div>, document.body) : canvas}
      <div className="link-filter" role="radiogroup" aria-label="Links to show">
        <span>Links</span>
        {([['all', 'All'], ['same', 'Same island'], ['other', 'Other islands']] as const).map(([v, label]) => (
          <button key={v} role="radio" aria-checked={linkFilter === v} className={`pill ${linkFilter === v ? 'active' : ''}`} onClick={() => setLinkFilter(v)}>{label}</button>
        ))}
      </div>
      <div className="field-hint" style={{ marginTop: 6 }}>
        Pinch or use +/− to zoom, drag to move. Tap a person to highlight their connections, then Edit. {isMap ? 'Each marker is an island (number = people living there now; red = has dealers). Purple lines join islands whose people are linked. Tap an island, then Open network to see its people. Set each island\'s atoll in the Islands tab.' : 'Each circle is an island. Lines inside a circle link people on the same island; purple lines link people on different islands (the number is how many links). Tap a person to see their own links. Green ring: moved here from another island.'}
      </div>
      {editing && sel && (
        <EditNetwork person={sel} persons={persons} islands={islands} onClose={() => setEditing(false)} />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Editable network sheet: categories + connections for one person.
// ---------------------------------------------------------------------------
const EditNetwork: React.FC<{ person: Person; persons: Person[]; islands: Island[]; onClose: () => void }> = ({ person, persons, islands, onClose }) => {
  const { upsert } = useStore();
  const [cats, setCats] = useState<PersonCategory[]>(displayCategories(person));
  const [links, setLinks] = useState<string[]>(() => {
    const s = new Set(person.linkedPersonIds ?? []);
    // include links that other people declared towards this person
    persons.forEach((o) => { if (o.id !== person.id && (o.linkedPersonIds ?? []).includes(person.id)) s.add(o.id); });
    return [...s];
  });
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const islandName = (id: string) => islands.find((i) => i.id === id)?.name ?? '';
  const toggleCat = (c: PersonCategory) => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const candidates = persons
    .filter((p) => p.id !== person.id && !links.includes(p.id))
    .filter((p) => {
      const t = q.trim().toLowerCase();
      return !t || displayName(p).toLowerCase().includes(t) || ((p as any).nickname ?? '').toLowerCase().includes(t);
    })
    .slice(0, 30);

  const save = async () => {
    await upsert('persons', touchRecord({ ...person, categories: cats, linkedPersonIds: links } as Person));
    // keep links two-way: removed connections are also removed on the other side
    for (const o of persons) {
      if (o.id === person.id) continue;
      const ol = o.linkedPersonIds ?? [];
      if (!links.includes(o.id) && ol.includes(person.id)) {
        await upsert('persons', touchRecord({ ...o, linkedPersonIds: ol.filter((x) => x !== person.id) } as Person));
      }
    }
    onClose();
  };

  return (
    <Modal title={`Edit network — ${shortLabel(person, 24)}`} onClose={onClose}>
      <div className="field">
        <label>Categories</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_CATEGORIES.map((c) => (
            <button type="button" key={c} className={`pill ${cats.includes(c) ? 'active' : ''}`} onClick={() => toggleCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Connected to ({links.length})</label>
        {links.length === 0 && <div className="field-hint">No connections yet.</div>}
        {links.map((id) => {
          const o = byId.get(id);
          if (!o) return null;
          return (
            <div key={id} className="net-row">
              <div className="net-row-main">
                <div className="net-row-name">{displayName(o)}</div>
                <div className="net-row-sub">{islandName(o.islandId)} · {displayCategories(o).join(', ') || '—'}</div>
              </div>
              <button type="button" className="net-mini net-mini-danger" aria-label="Remove connection"
                onClick={() => setLinks((l) => l.filter((x) => x !== id))}><X size={16} /></button>
            </div>
          );
        })}
      </div>

      <div className="field">
        <label>Add connection</label>
        <input style={{ marginBottom: 8 }} placeholder="Search name or nickname" value={q} onChange={(e) => setQ(e.target.value)} />
        {candidates.map((p) => (
          <div key={p.id} className="net-row">
            <div className="net-row-main">
              <div className="net-row-name">{displayName(p)}</div>
              <div className="net-row-sub">{islandName(p.islandId)} · {displayCategories(p).join(', ') || '—'}</div>
            </div>
            <button type="button" className="net-mini" aria-label="Add connection"
              onClick={() => setLinks((l) => [...l, p.id])}><Plus size={16} /></button>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
};

export default NetworkMap;

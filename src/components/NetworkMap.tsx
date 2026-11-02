import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, Maximize2, Minimize2, LocateFixed, Pencil, X } from 'lucide-react';
import type { Person, Island, PersonCategory } from '../types';
import { useStore, touchRecord } from '../state/store';
import {
  displayCategories, shortLabel, displayName, personChainRank, categoryColor, currentIslandId, livesAway, flowDir, flowIsSet,
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
// ab / ba: links where supply flows from island a to b / b to a; count = all links (incl. undirected)
interface PairLink { a: string; b: string; count: number; ab: number; ba: number }

/** Count a link into an island pair, noting supply direction (from = upstream island). */
function countPair(m: Map<string, PairLink>, ia: string, ib: string, fromIsland?: string) {
  const key = [ia, ib].sort().join('|');
  const cur = m.get(key) ?? { a: ia, b: ib, count: 0, ab: 0, ba: 0 };
  cur.count += 1;
  if (fromIsland === cur.a) cur.ab += 1; else if (fromIsland === cur.b) cur.ba += 1;
  m.set(key, cur);
}
interface Marker { iid: string; x: number; y: number; count: number; dealers: number; users: number; exact: boolean }
interface Edge { a: string; b: string; from?: string; to?: string; color: string; cross: boolean }
interface View { x: number; y: number; k: number }

/** Stable pseudo-random number 0..1 from an id (same person -> same offset every time). */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

/** Filled arrowhead with its tip at the point t (0..1) along x1,y1 -> x2,y2; s = half-width. */
function arrowHead(x1: number, y1: number, x2: number, y2: number, s: number, t = 1): string {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const tx = x1 + dx * t, ty = y1 + dy * t;
  const bx = tx - ux * s * 1.8, by = ty - uy * s * 1.8;
  return `M${tx} ${ty}L${bx - uy * s} ${by + ux * s}L${bx + uy * s} ${by - ux * s}Z`;
}

const NetworkMap: React.FC<{ persons: Person[]; islands: Island[]; islandId: string; onOpenIsland?: (id: string) => void }> = ({ persons, islands, islandId, onOpenIsland }) => {
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [selIsland, setSelIsland] = useState<string | null>(null);
  // Tapped link: an island pair (a|b island ids) or a single person-to-person link (a|b person ids)
  const [selLink, setSelLink] = useState<{ kind: 'pair' | 'edge'; a: string; b: string } | null>(null);
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
        const fd = flowDir(p, t);
        countPair(pmap, ia, ib, fd === 'pt' ? ia : fd === 'tp' ? ib : undefined);
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
        const n = list.length;
        if (n === 0) return;
        if (n === 1) { out.push({ p: list[0], x: cx, y: cy, r: Math.min(11, rb * 0.3) }); return; }
        // Supply-chain rows: suppliers at the top, the people they supply below, unlinked people at the bottom
        const inIsl = new Set(list.map((p) => p.id));
        const down = new Map<string, string[]>(); // supplier -> supplied
        const linked = new Set<string>();
        const pairSeen = new Set<string>();
        list.forEach((p) => (p.linkedPersonIds ?? []).forEach((tid) => {
          const t = byId.get(tid);
          if (!t || !inIsl.has(tid) || tid === p.id) return;
          const key = [p.id, tid].sort().join('|');
          if (pairSeen.has(key)) return;
          pairSeen.add(key);
          linked.add(p.id); linked.add(tid);
          const fd = flowDir(p, t);
          if (fd === 'pt') down.set(p.id, [...(down.get(p.id) ?? []), tid]);
          if (fd === 'tp') down.set(tid, [...(down.get(tid) ?? []), p.id]);
        }));
        const hasDir = new Set<string>();
        down.forEach((vs, u) => { hasDir.add(u); vs.forEach((v) => hasDir.add(v)); });
        const depth = new Map<string, number>();
        list.forEach((p) => depth.set(p.id, hasDir.has(p.id) ? 0 : (personChainRank(p) ?? 1)));
        for (let it = 0; it < n; it++) { // longest path from a top supplier (bounded, so loops can't run forever)
          let changed = false;
          down.forEach((vs, u) => vs.forEach((v) => {
            const d = (depth.get(u) ?? 0) + 1;
            if (d > (depth.get(v) ?? 0) && d <= n) { depth.set(v, d); changed = true; }
          }));
          if (!changed) break;
        }
        const layered = list.filter((p) => linked.has(p.id));
        const loose = list.filter((p) => !linked.has(p.id)).sort(rankSort);
        const levels = [...new Set(layered.map((p) => depth.get(p.id)!))].sort((x, y) => x - y);
        const perLine = Math.max(3, Math.round(Math.sqrt(n) * 1.5));
        const lines: Person[][] = [];
        levels.forEach((lv) => {
          const row = layered.filter((p) => depth.get(p.id) === lv).sort(rankSort);
          for (let i = 0; i < row.length; i += perLine) lines.push(row.slice(i, i + perLine));
        });
        for (let i = 0; i < loose.length; i += perLine + 1) lines.push(loose.slice(i, i + perLine + 1));
        const m = lines.length;
        const span = rb * (m > 1 ? 0.66 : 0);
        const placed = new Map<string, number>(); // x of placed people, to order the next row under its suppliers
        const ups = new Map<string, string[]>();
        down.forEach((vs, u) => vs.forEach((v) => ups.set(v, [...(ups.get(v) ?? []), u])));
        const geo = lines.map((line, li) => {
          const y = cy - span + (m > 1 ? (2 * span * li) / (m - 1) : 0);
          const hc = Math.sqrt(Math.max(rb * rb - (y - cy) * (y - cy), 0)) * 0.8;
          return { line, y, hc, gap: line.length > 1 ? (2 * hc) / (line.length - 1) : 2 * hc };
        });
        const rowGap = m > 1 ? (2 * span) / (m - 1) : rb;
        const dot = Math.max(3.5, Math.min(11, rb * 0.2, rowGap * 0.3, ...geo.map((g) => g.gap * 0.32)));
        geo.forEach(({ line, y, hc }) => {
          const ordered = [...line].sort((p1, p2) => {
            const bx = (p: Person) => { const xs = (ups.get(p.id) ?? []).map((u) => placed.get(u)).filter((v): v is number => v !== undefined); return xs.length ? xs.reduce((a2, b2) => a2 + b2, 0) / xs.length : cx; };
            return bx(p1) - bx(p2);
          });
          const gapX = ordered.length > 1 ? (2 * hc) / (ordered.length - 1) : hc;
          ordered.forEach((p, i) => {
            // small fixed offsets (from the person's id) so rows aren't a rigid grid and arrows don't line up
            const jx = (jitter(p.id, 1) - 0.5) * Math.min(gapX * 0.35, rb * 0.12);
            const jy = (jitter(p.id, 2) - 0.5) * rowGap * 0.34 + (i % 2 ? rowGap * 0.12 : -rowGap * 0.12);
            let x = (ordered.length > 1 ? cx - hc + (2 * hc * i) / (ordered.length - 1) : cx) + jx;
            let yy = y + (m > 1 ? jy : 0);
            const d = Math.hypot(x - cx, yy - cy), lim = rb - dot * 1.8; // stay inside the island circle
            if (d > lim) { x = cx + ((x - cx) / d) * lim; yy = cy + ((yy - cy) / d) * lim; }
            placed.set(p.id, x);
            out.push({ p, x, y: yy, r: dot });
          });
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
        fill(islandId, here, W / 2 - 14, H / 2 + 14, ol.length ? 106 : 128, true);
        ol.forEach(([iid, list], i) => {
          const ang = (i / ol.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / Math.max(ol.length, 2); // half-step rotation keeps the top-left clear
          const rb = Math.min(40, 18 + list.length * 5, ol.length > 6 ? 30 : 40);
          fill(iid, list, W / 2 - 14 + Math.cos(ang) * 146, H / 2 + 14 + Math.sin(ang) * 146, Math.min(rb, 34));
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
      const fd = flowDir(p, t.p);
      let from: string | undefined, to: string | undefined, color = '#8a8f98';
      if (fd) {
        from = fd === 'pt' ? p.id : tid; to = fd === 'pt' ? tid : p.id;
        // red when the supplier is a Dealer, orange for street dealers / carriers
        const supplier = fd === 'pt' ? p : t.p;
        color = displayCategories(supplier).includes('Dealer') ? RED : ORANGE;
      }
      es.push({ a: p.id, b: tid, from, to, color, cross: currentIslandId(p) !== currentIslandId(t.p) });
    }));
    // Links between islands, counted per island pair (drawn as one line between bubbles)
    const pm = new Map<string, PairLink>();
    es.forEach((e) => {
      if (!e.cross) return;
      const ia = currentIslandId(pos.get(e.a)!.p), ib = currentIslandId(pos.get(e.b)!.p);
      countPair(pm, ia, ib, e.from ? currentIslandId(pos.get(e.from)!.p) : undefined);
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
  useEffect(() => { setView(homeView()); setSelected(null); setSelIsland(null); setSelLink(null); }, [islandId, isMap]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (isle) {
        const iid = isle.getAttribute('data-iid')!;
        if (!isMap && onOpenIsland) { onOpenIsland(iid); return; } // Network view: open that island's network
        setSelIsland(iid); setSelected(null); setSelLink(null); return;
      }
      const hit = el?.closest('[data-pid]');
      if (hit) { setSelected(hit.getAttribute('data-pid')); setSelIsland(null); setSelLink(null); return; }
      const link = el?.closest('[data-link]');
      if (link) {
        const [kind, a, b] = link.getAttribute('data-link')!.split('|');
        setSelLink({ kind: kind as 'pair' | 'edge', a, b }); setSelected(null); setSelIsland(null); return;
      }
      setSelected(null); setSelIsland(null); setSelLink(null);
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
  const { upsert } = useStore();
  /** Save a supply direction between two people: 'ab' = a supplies b, 'ba', or null (clear, back to guessing). */
  const setFlow = async (a: Person, b: Person, dir: 'ab' | 'ba' | null) => {
    const fresh = (p: Person) => persons.find((x) => x.id === p.id) ?? p;
    const A = fresh(a), B = fresh(b);
    const as = (A.supplies ?? []).filter((x) => x !== B.id);
    const bs = (B.supplies ?? []).filter((x) => x !== A.id);
    if (dir === 'ab') as.push(B.id);
    if (dir === 'ba') bs.push(A.id);
    await upsert('persons', touchRecord({ ...A, supplies: as }));
    await upsert('persons', touchRecord({ ...B, supplies: bs }));
  };
  // Arrow tap: shown direction -> reversed -> cleared (guess) -> ...
  const cycleFlow = (up: Person, down: Person, directed: boolean, set: boolean) => {
    if (!directed) return setFlow(up, down, 'ab');   // no direction yet: up supplies down
    if (!set) return setFlow(up, down, 'ab');        // confirm the guessed direction
    return setFlow(up, down, 'ba').then(() => undefined); // reverse
  };
  const linkShown = (e: Edge) => (linkFilter === 'same' ? !e.cross : linkFilter === 'other' ? e.cross : true);
  // All-islands Network view: links between islands are bundled into one line per island pair,
  // except the tapped person's own links, which are drawn person to person.
  const bundled = !isMap && !islandId;
  const bubbleOf = useMemo(() => new Map(bubbles.map((b) => [b.iid, b])), [bubbles]);

  /**
   * Line pieces for an island pair: one arrowed line per supply direction
   * (two side-by-side lines when supply goes both ways), or a plain line
   * when no direction is known. u = 1 in Network view, 1/k in Map view.
   */
  const pairSegs = (pl: PairLink, A: { x: number; y: number; r: number }, B: { x: number; y: number; r: number }, u: number) => {
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const und = pl.count - pl.ab - pl.ba;
    const both = pl.ab > 0 && pl.ba > 0;
    const off = both ? 6 * u : 0;
    const seg = (dir: 'ab' | 'ba' | null, count: number, o: number, t = 0.5) => {
      const [S, T, sx, sy] = dir === 'ba' ? [B, A, -ux, -uy] : [A, B, ux, uy];
      const x1 = S.x + sx * S.r + nx * o, y1 = S.y + sy * S.r + ny * o;
      const x2 = T.x - sx * (T.r + 1.5 * u) + nx * o, y2 = T.y - sy * (T.r + 1.5 * u) + ny * o;
      return { dir, count, x1, y1, x2, y2, mx: x1 + (x2 - x1) * t, my: y1 + (y2 - y1) * t };
    };
    // badges staggered (35% / 35% from each source) so the two counts don't overlap
    if (both) return [seg('ab', pl.ab + Math.ceil(und / 2), off, 0.35), seg('ba', pl.ba + Math.floor(und / 2), -off, 0.35)];
    if (pl.ab) return [seg('ab', pl.count, 0)];
    if (pl.ba) return [seg('ba', pl.count, 0)];
    return [seg(null, pl.count, 0)];
  };
  const markerR = (m: Marker) => (8 + Math.min(m.count, 40) * 0.28) / view.k;
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
            const isSelL = selLink?.kind === 'pair' && [selLink.a, selLink.b].sort().join('|') === [pl.a, pl.b].sort().join('|');
            const hot = isSelL || (!!focus && (pl.a === focus || pl.b === focus));
            const dimmed = (focus || selLink) && !hot;
            const u = 1 / view.k;
            const segs = pairSegs(pl, { x: A.x, y: A.y, r: markerR(A) }, { x: B.x, y: B.y, r: markerR(B) }, u);
            return (
              <g key={'mp' + pl.a + pl.b} data-link={`pair|${pl.a}|${pl.b}`} style={{ cursor: 'pointer' }} opacity={dimmed ? 0.15 : 0.95}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="transparent" strokeWidth={18 * u} />
                {segs.map((g, gi) => (
                  <line key={gi} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={PURPLE} strokeLinecap="round"
                    strokeWidth={(isSelL ? 2.8 : 1.6 + Math.min(g.count, 5) * 0.35) * u}
                    strokeDasharray={`${5 * u} ${3 * u}`} className={g.dir ? 'flow' : undefined}
                    style={{ ['--dash' as string]: `${-8 * u}` }} />
                ))}
                {segs.map((g, gi) => g.dir && (
                  <g key={'h' + gi} fill={PURPLE} stroke="#fff" strokeWidth={0.8 * u} strokeLinejoin="round">
                    <path d={arrowHead(g.x1, g.y1, g.x2, g.y2, 7 * u)} />
                    <path d={arrowHead(g.x1, g.y1, g.x2, g.y2, 6 * u, 0.62)} />
                  </g>
                ))}
              </g>
            );
          })}
          {isMap && markers.map((m) => {
            const r = markerR(m);
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
              strokeWidth={b.main ? 1.6 : 1}
              // tapping an island circle opens that island's network (not the chosen island itself)
              data-iid={b.main ? undefined : b.iid} style={{ pointerEvents: b.main ? 'none' : 'auto', cursor: 'pointer' }} />
          ))}
          {bundled && linkFilter !== 'same' && pairs.map((pl) => {
            const A = bubbleOf.get(pl.a), B = bubbleOf.get(pl.b);
            if (!A || !B) return null;
            const segs = pairSegs(pl, A, B, 1);
            const isSelL = selLink?.kind === 'pair' && [selLink.a, selLink.b].sort().join('|') === [pl.a, pl.b].sort().join('|');
            const faded = !!selected || (!!selLink && !isSelL);
            return (
              <g key={'pl' + pl.a + pl.b} opacity={faded ? 0.15 : 0.95} data-link={`pair|${pl.a}|${pl.b}`} style={{ cursor: 'pointer' }}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="transparent" strokeWidth={18} />
                {segs.map((g, gi) => (
                  <g key={gi}>
                    <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={PURPLE} strokeLinecap="round"
                      strokeWidth={isSelL ? 3 : 1.6 + Math.min(g.count, 5) * 0.35} strokeDasharray="5 3"
                      className={g.dir ? 'flow' : undefined} style={{ ['--dash' as string]: '-8' }} />
                    {g.dir && (
                      <g fill={PURPLE} stroke="#fff" strokeWidth={0.8} strokeLinejoin="round">
                        <path d={arrowHead(g.x1, g.y1, g.x2, g.y2, 6.5)} />
                        <path d={arrowHead(g.x1, g.y1, g.x2, g.y2, 5.5, 0.72)} />
                      </g>
                    )}
                    <circle cx={g.mx} cy={g.my} r={6.5} fill={PURPLE} />
                    <text x={g.mx} y={g.my + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff">{g.count}</text>
                  </g>
                ))}
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
            const isSelE = selLink?.kind === 'edge' && [selLink.a, selLink.b].sort().join('|') === [e.a, e.b].sort().join('|');
            const faded = (!!selected && !hot) || (!!selLink && !isSelE);
            return (
              <g key={i} data-link={`edge|${e.a}|${e.b}`} style={{ cursor: 'pointer', pointerEvents: bundled && !e.cross ? 'none' : 'auto' }}>
              <line x1={A.x} y1={A.y} x2={x2} y2={y2} stroke="transparent" strokeWidth={isMap ? 14 / view.k : 14 / Math.sqrt(view.k)} />
              <line x1={A.x} y1={A.y} x2={x2} y2={y2} stroke={e.cross ? PURPLE : e.color}
                strokeWidth={isMap ? (hot || isSelE ? 2 : 1.1) / view.k : (hot || isSelE ? 3.4 : 1.8) / Math.sqrt(view.k)}
                strokeDasharray={e.cross || !e.from ? (isMap ? `${4 / view.k} ${2 / view.k}` : '6 3') : undefined}
                className={e.cross && e.from ? 'flow' : undefined} style={{ ['--dash' as string]: '-9' }}
                opacity={faded ? 0.12 : 0.9}
                />
              {e.from && (() => {
                const hs = isMap ? 6 / view.k : 6 / Math.sqrt(view.k);
                const col = e.cross ? PURPLE : e.color;
                return (
                  <g fill={col} opacity={faded ? 0.12 : 1} stroke="var(--card)" strokeWidth={hs * 0.15} strokeLinejoin="round">
                    <path d={arrowHead(A.x, A.y, x2, y2, hs)} />
                    {Math.hypot(x2 - A.x, y2 - A.y) > hs * 9 && <path d={arrowHead(A.x, A.y, x2, y2, hs * 0.8, 0.55)} />}
                  </g>
                );
              })()}
              </g>
            );
          })}
          {nodes.map(({ p, x, y, outside, r }) => {
            const cats = displayCategories(p);
            const R = isMap ? nodeR : (r ?? 11);
            const u = isMap ? 1 / view.k : 1; // ring and outline thickness
            const isSel = p.id === selected;
            return (
              <g key={p.id} data-pid={p.id} opacity={dim(p.id) ? 0.2 : 1} style={{ cursor: 'pointer', pointerEvents: bundled || (!isMap && islandId && currentIslandId(p) !== islandId) ? 'none' : 'auto' }}>
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
            const pa = at(A.x, A.y), pb = at(B.x, B.y);
            if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 48) return; // too short to label without covering the markers
            pairSegs(pl, { x: A.x, y: A.y, r: markerR(A) }, { x: B.x, y: B.y, r: markerR(B) }, 1 / view.k).forEach((g, gi) => {
              const q = at(g.mx, g.my);
              if (inView(q)) out.push(<div key={'pc' + pl.a + pl.b + gi} className="pair-count" style={{ left: q.x, top: q.y }}>{g.count}</div>);
            });
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

      {selLink && (() => {
        const byId = new Map(persons.map((p) => [p.id, p]));
        // every person-to-person link for this line, upstream person first
        const rows: { up: Person; down: Person; directed: boolean; set: boolean }[] = [];
        const seenK = new Set<string>();
        const add = (p: Person, t: Person) => {
          const key = [p.id, t.id].sort().join('|');
          if (seenK.has(key)) return; seenK.add(key);
          const fd = flowDir(p, t);
          const set = flowIsSet(p, t);
          rows.push(fd === 'tp' ? { up: t, down: p, directed: true, set } : { up: p, down: t, directed: fd === 'pt', set });
        };
        if (selLink.kind === 'edge') {
          const p = byId.get(selLink.a), t = byId.get(selLink.b);
          if (p && t) add(p, t);
        } else {
          persons.forEach((p) => (p.linkedPersonIds ?? []).forEach((tid) => {
            const t = byId.get(tid);
            if (!t) return;
            const ia = currentIslandId(p), ib = currentIslandId(t);
            if ((ia === selLink.a && ib === selLink.b) || (ia === selLink.b && ib === selLink.a)) add(p, t);
          }));
        }
        rows.sort((x, y) => (personChainRank(x.up) ?? 9) - (personChainRank(y.up) ?? 9));
        const title = selLink.kind === 'pair'
          ? `${islandName(selLink.a)} ↔ ${islandName(selLink.b)}`
          : rows[0] && currentIslandId(rows[0].up) !== currentIslandId(rows[0].down) ? 'Link between islands' : 'Link on the same island';
        const who = (p: Person) => (
          <div className="link-person" onClick={() => { if (!isMap) { setSelected(p.id); setSelLink(null); } }}>
            <div dir="auto" className="lp-name">{shortLabel(p, 22)}</div>
            <div className="lp-sub">{islandName(currentIslandId(p))} · {displayCategories(p).join(', ') || '—'}</div>
          </div>
        );
        return (
          <div className="net-sheet link-sheet">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div dir="auto" style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{rows.length} link{rows.length === 1 ? '' : 's'}</div>
              </div>
              {isMap && selLink.kind === 'pair' && onOpenIsland && (
                <button className="btn btn-primary" onClick={() => { onOpenIsland(selLink.a); setMode('network'); }}>Open network</button>
              )}
              <button className="icon-btn" aria-label="Close" onClick={() => setSelLink(null)}><X size={16} /></button>
            </div>
            <div className="link-hint">Tap the arrow to set who supplies whom.</div>
            <div className="link-rows">
              {rows.map((r) => (
                <div key={r.up.id + r.down.id} className="link-row">
                  {who(r.up)}
                  <button type="button" className={`lr-arrow ${r.set ? 'set' : ''}`} aria-label="Change direction"
                    onClick={() => cycleFlow(r.up, r.down, r.directed, r.set)}>
                    {r.directed ? '→' : '—'}
                    <small>{r.set ? 'set' : r.directed ? 'guess' : 'tap'}</small>
                  </button>
                  {who(r.down)}
                  {r.set && <button type="button" className="lr-clear" aria-label="Clear direction" onClick={() => setFlow(r.up, r.down, null)}>auto</button>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
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
        Pinch or use +/− to zoom, drag to move. {isMap ? 'Each marker is an island (number = people living there now; red = has dealers). Purple lines join islands whose people are linked. Tap an island, then Open network to see its people. Set each island\'s atoll in the Islands tab.' : (islandId ? 'Tap a person to see their links and edit. Tap a smaller circle to open that island. ' : 'Tap an island circle to open its network. ') + 'Lines inside a circle link people on the same island; purple arrows link people on different islands (number = links). Green ring: moved here from another island.'}
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
  // Supply direction per connection: out = this person supplies them, in = they supply this person
  const [dirs, setDirs] = useState<Record<string, 'out' | 'in' | 'auto'>>(() => {
    const d: Record<string, 'out' | 'in' | 'auto'> = {};
    persons.forEach((o) => {
      if ((person.supplies ?? []).includes(o.id)) d[o.id] = 'out';
      else if ((o.supplies ?? []).includes(person.id)) d[o.id] = 'in';
    });
    return d;
  });
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
    const supplies = links.filter((id) => dirs[id] === 'out');
    await upsert('persons', touchRecord({ ...person, categories: cats, linkedPersonIds: links, supplies } as Person));
    // keep links two-way (removed connections go on both sides) and keep the other side's supply list in step
    for (const o of persons) {
      if (o.id === person.id) continue;
      const ol = o.linkedPersonIds ?? [];
      const os = o.supplies ?? [];
      const linked = links.includes(o.id);
      const nextL = !linked && ol.includes(person.id) ? ol.filter((x) => x !== person.id) : ol;
      const wantIn = linked && dirs[o.id] === 'in';
      const nextS = wantIn ? (os.includes(person.id) ? os : [...os, person.id]) : os.filter((x) => x !== person.id);
      if (nextL !== ol || nextS.length !== os.length) {
        await upsert('persons', touchRecord({ ...o, linkedPersonIds: nextL, supplies: nextS } as Person));
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
              <div className="dir-seg" role="radiogroup" aria-label="Who supplies whom">
                {([['out', 'Supplies'], ['in', 'Gets from'], ['auto', 'Auto']] as const).map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={(dirs[id] ?? 'auto') === v}
                    className={(dirs[id] ?? 'auto') === v ? 'on' : ''} onClick={() => setDirs((d) => ({ ...d, [id]: v }))}>{label}</button>
                ))}
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

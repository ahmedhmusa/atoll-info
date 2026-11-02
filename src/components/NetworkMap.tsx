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
import { MAP_PATHS, MAP_W, MAP_H, ATOLLS, ATOLL_ANCHORS, islandAtoll } from '../lib/maldivesMap';

const W = 360;
const H = 360;
const MIN_K = 0.6;
const MAX_K_NET = 6;
const MAX_K_MAP = 40;
// Map view: the whole country fits the 360-unit canvas height
const MS = (H - 20) / MAP_H;
const MX0 = W / 2 - (MAP_W * MS) / 2 - 20;
const MY0 = 10;
const toWorld = (mx: number, my: number) => ({ x: MX0 + mx * MS, y: MY0 + my * MS });
const ALL_CATEGORIES: PersonCategory[] = ['Dealer', 'Street Dealer', 'Carrier', 'Drug User', 'Theft', 'Person of Interest'];
const RED = '#e0362e';
const ORANGE = '#e0a53d';

interface Node { p: Person; x: number; y: number; outside?: boolean }
interface Edge { a: string; b: string; from?: string; to?: string; color: string; cross: boolean }
interface View { x: number; y: number; k: number }

const NetworkMap: React.FC<{ persons: Person[]; islands: Island[]; islandId: string }> = ({ persons, islands, islandId }) => {
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<'network' | 'map'>('network');
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
  const { nodes, edges } = useMemo(() => {
    const byId = new Map(persons.map((p) => [p.id, p]));
    const rankSort = (a: Person, b: Person) => (personChainRank(a) ?? 9) - (personChainRank(b) ?? 9);
    const out: Node[] = [];
    const ring = (list: Person[], cx: number, cy: number, r: number, outside?: boolean) => {
      // outer ring is rotated half a step so its people sit between the inner ones
      const offset = outside ? Math.PI / Math.max(list.length, 2) + 0.35 : 0;
      list.forEach((p, i) => {
        const ang = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2 + offset;
        out.push({ p, x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, outside });
      });
    };
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
        const list = [...isles.entries()];
        const ringR = list.length > 1 ? 8 + list.length * 3 : 0;
        list.forEach(([, ppl], ii) => {
          const a = (ii / list.length) * Math.PI * 2 - Math.PI / 2;
          const ix = ax + Math.cos(a) * ringR, iy = ay + Math.sin(a) * ringR;
          const sorted = [...ppl].sort(rankSort);
          const pr = sorted.length > 1 ? Math.max(3, sorted.length * 1.4) : 0;
          sorted.forEach((p, k) => {
            const b = (k / sorted.length) * Math.PI * 2 - Math.PI / 2;
            const w = toWorld(ix + Math.cos(b) * pr, iy + Math.sin(b) * pr);
            out.push({ p, x: w.x, y: w.y, outside: false });
          });
        });
      });
    } else if (islandId) {
      // Main ring: everyone living on this island now (incl. people who moved here)
      const here = persons.filter((p) => currentIslandId(p) === islandId).sort(rankSort);
      ring(here, W / 2, H / 2, here.length > 1 ? Math.min(Math.max(60, (here.length * 38) / (Math.PI * 2)), 120) : 0);
      const ids = new Set(here.map((p) => p.id));
      const ext = new Set<string>();
      // Outer ring: people from this island who now live elsewhere, plus linked outsiders
      persons.forEach((p) => { if (!ids.has(p.id) && p.islandId === islandId) ext.add(p.id); });
      here.forEach((p) => (p.linkedPersonIds ?? []).forEach((id) => { if (!ids.has(id) && byId.has(id)) ext.add(id); }));
      persons.forEach((p) => { if (!ids.has(p.id) && (p.linkedPersonIds ?? []).some((id) => ids.has(id))) ext.add(p.id); });
      ring([...ext].map((id) => byId.get(id)!), W / 2, H / 2 - 6, 148, true);
    } else {
      const groups = islands
        .map((i) => ({ i, list: persons.filter((p) => currentIslandId(p) === i.id).sort(rankSort) }))
        .filter((g) => g.list.length > 0);
      groups.forEach((g, gi) => {
        const ang = (gi / Math.max(groups.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const cx = W / 2 + Math.cos(ang) * (groups.length > 1 ? 120 : 0);
        const cy = H / 2 + Math.sin(ang) * (groups.length > 1 ? 120 : 0);
        // ~38 units of circumference per person so labels don't collide
        const want = g.list.length > 1 ? Math.max(26, (g.list.length * 38) / (Math.PI * 2)) : 0;
        ring(g.list, cx, cy, groups.length > 1 ? Math.min(want, 70) : Math.min(want, 150));
      });
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
    return { nodes: out, edges: es };
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
      const here = nodes.filter((n) => currentIslandId(n.p) === islandId);
      if (here.length) {
        const cx = here.reduce((t, n) => t + n.x, 0) / here.length;
        const cy = here.reduce((t, n) => t + n.y, 0) / here.length;
        const k = 20;
        return { k, x: W / 2 - cx * k, y: H / 2 - cy * k };
      }
      const isl = islands.find((i) => i.id === islandId);
      const at = islandAtoll(isl);
      if (at) { const w = toWorld(...ATOLL_ANCHORS[at]); const k = 8; return { k, x: W / 2 - w.x * k, y: H / 2 - w.y * k }; }
    }
    return { x: 0, y: 0, k: 1 };
  };
  useEffect(() => { setView(homeView()); setSelected(null); }, [islandId, isMap]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pid]');
      setSelected(hit ? hit.getAttribute('data-pid') : null);
    }
  };

  const reset = () => setView(homeView());
  const focusSelected = () => {
    const n = selected ? nodeMap.get(selected) : null;
    if (!n) return;
    const k = isMap ? Math.max(view.k, 16) : 2.2;
    setView({ k, x: W / 2 - n.x * k, y: H / 2 - n.y * k });
  };

  const sel = selected ? nodeMap.get(selected)?.p ?? null : null;
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
          <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={ORANGE} />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {isMap && (
            <g style={{ pointerEvents: 'none' }}>
              <g transform={`translate(${MX0} ${MY0}) scale(${MS})`}>
                {MAP_PATHS.map((d, i) => <path key={i} d={d} fill="var(--map-land)" stroke="var(--map-edge)" strokeWidth={1.2 / view.k / MS * 0.5} />)}
              </g>
              {ATOLLS.map((a) => {
                const w = toWorld(...ATOLL_ANCHORS[a.code]);
                const left = ATOLL_ANCHORS[a.code][0] < MAP_W * 0.55;
                const fs = 9 / view.k; // constant on-screen size
                return (
                  <text key={a.code} x={w.x + (left ? -1 : 1) * (14 * MS + 8 / view.k)} y={w.y + fs * 0.35} fontSize={fs}
                    textAnchor={left ? 'end' : 'start'} fill="var(--text-dim)" fontWeight={600}>
                    {view.k > 3 ? a.name : a.code}
                  </text>
                );
              })}
              {nodes.some((n) => islandAtoll(islands.find((i) => i.id === currentIslandId(n.p))) === undefined) && (() => {
                const w = toWorld(MAP_W + 70, 455);
                return <text x={w.x} y={w.y} fontSize={9 / view.k} textAnchor="middle" fill="var(--warn)" fontWeight={600}>Atoll not set</text>;
              })()}
            </g>
          )}
          {edges.map((e, i) => {
            const A = nodeMap.get(e.from ?? e.a)!, B = nodeMap.get(e.to ?? e.b)!;
            let x2 = B.x, y2 = B.y;
            if (e.from) {
              const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
              x2 = B.x - (dx / len) * (nodeR + 1); y2 = B.y - (dy / len) * (nodeR + 1);
            }
            const hot = !!selected && (e.a === selected || e.b === selected);
            const faded = !!selected && !hot;
            return (
              <line key={i} x1={A.x} y1={A.y} x2={x2} y2={y2} stroke={e.color}
                strokeWidth={isMap ? (hot ? 2 : 1.1) / view.k : (hot ? 3 : 1.8) / Math.sqrt(view.k)}
                strokeDasharray={e.cross || !e.from ? (isMap ? `${4 / view.k} ${2 / view.k}` : '6 3') : undefined}
                opacity={faded ? 0.12 : 0.9}
                markerEnd={e.from ? (e.color === RED ? 'url(#arrow-red)' : 'url(#arrow-orange)') : undefined} />
            );
          })}
          {nodes.map(({ p, x, y, outside }) => {
            const cats = displayCategories(p);
            const R = nodeR;
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
          {!islandId && !isMap && (() => {
            const seenI = new Set<string>();
            return nodes.map(({ p, x, y }) => {
              const ci = currentIslandId(p);
              if (seenI.has(ci)) return null;
              seenI.add(ci);
              return (
                <text key={'l' + ci} x={x} y={y - 24} textAnchor="middle" fontSize={10 / Math.sqrt(view.k)} fontWeight={700}
                  fill="var(--text-dim)" style={{ pointerEvents: 'none' }}>{islandName(ci)}</text>
              );
            });
          })()}
        </g>
      </svg>
      {/* Names are normal HTML text (same rendering as the Persons list) so
          Dhivehi right-to-left script displays correctly on iPhone. */}
      <div className="net-labels" aria-hidden="true">
        {(() => {
          const sc = Math.min(box.w, box.h) / W;
          const ox = (box.w - W * sc) / 2, oy = (box.h - H * sc) / 2;
          const fs = isMap ? 12 : Math.max(12, Math.min(17, 12 * Math.sqrt(view.k) * sc));
          return nodes.map(({ p, x, y }) => {
            // Map view: names appear once zoomed in (always for the selected person and their links)
            if (isMap && view.k < 7 && p.id !== selected && !neighbours.has(p.id)) return null;
            const sx = ox + (view.x + x * view.k) * sc;
            const sy = oy + (view.y + y * view.k) * sc + nodeR * view.k * sc + 2;
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
      <div className="field-hint" style={{ marginTop: 6 }}>
        Pinch or use +/− to zoom, drag to move. Tap a person to highlight their connections, then Edit. {isMap ? 'Map shows everyone on the atoll of their present island — zoom in to see names. Set each island\'s atoll in the Islands tab.' : 'Green ring: moved here from another island. Dashed ring: from another island or living elsewhere now.'}
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

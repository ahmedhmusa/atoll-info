import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import Badge from './Badge';
import { displayName, displayCategories, categoryColor, shortLabel, CATEGORY_COLORS } from '../lib/personDisplay';
import type { Person, Island } from '../types';

interface Props {
  persons: Person[];
  islands: Island[];
  /** When set, only that island's people are drawn (plus anyone they link to on other islands). */
  islandId: string;
}

interface Node { p: Person; x: number; y: number; }

/**
 * Draws people as dots and their "Linked Persons" as lines.
 * - One island selected: that island's people in a ring, plus anyone on
 *   OTHER islands they're linked to, shown outside the ring.
 * - All islands: each island is its own cluster, arranged around a big
 *   circle; links between islands are drawn dashed.
 * Each dot is split into colored slices — one per category the person has —
 * so any category edit is visible straight away.
 */
const NetworkMap: React.FC<Props> = ({ persons, islands, islandId }) => {
  const [sel, setSel] = useState<Person | null>(null);
  const islandName = (id: string) => islands.find((i) => i.id === id)?.name ?? '—';
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const layout = useMemo(() => {
    const nodes: Node[] = [];
    const labels: { text: string; x: number; y: number }[] = [];
    const size = islandId ? 300 : 360;
    const c = size / 2;

    if (islandId) {
      const core = persons.filter((p) => p.islandId === islandId);
      const coreIds = new Set(core.map((p) => p.id));
      // people elsewhere who are linked (either direction) to someone on this island
      const outside = persons.filter((p) => !coreIds.has(p.id) && (
        (p.linkedPersonIds ?? []).some((id) => coreIds.has(id)) ||
        core.some((q) => (q.linkedPersonIds ?? []).includes(p.id))
      ));
      const r = core.length <= 1 ? 0 : size * 0.3;
      core.forEach((p, i) => {
        const a = (i / Math.max(core.length, 1)) * 2 * Math.PI - Math.PI / 2;
        nodes.push({ p, x: c + r * Math.cos(a), y: c + r * Math.sin(a) });
      });
      outside.forEach((p, i) => {
        const a = (i / outside.length) * 2 * Math.PI - Math.PI / 2 + 0.3;
        nodes.push({ p, x: c + size * 0.45 * Math.cos(a), y: c + size * 0.45 * Math.sin(a) });
      });
      return { nodes, labels, size };
    }

    // All islands: one cluster per island that has people
    const groups = islands
      .map((isl) => ({ isl, people: persons.filter((p) => p.islandId === isl.id) }))
      .filter((g) => g.people.length > 0);
    const orphans = persons.filter((p) => !islands.some((i) => i.id === p.islandId));
    if (orphans.length) groups.push({ isl: { id: '_none', name: 'No island' } as Island, people: orphans });

    const bigR = groups.length <= 1 ? 0 : size * 0.33;
    groups.forEach((g, gi) => {
      const ga = (gi / groups.length) * 2 * Math.PI - Math.PI / 2;
      const gx = c + bigR * Math.cos(ga);
      const gy = c + bigR * Math.sin(ga);
      const smallR = g.people.length <= 1 ? 0 : Math.min(size * 0.12, 10 + g.people.length * 4);
      g.people.forEach((p, i) => {
        const a = (i / g.people.length) * 2 * Math.PI - Math.PI / 2;
        nodes.push({ p, x: gx + smallR * Math.cos(a), y: gy + smallR * Math.sin(a) });
      });
      const ly = gy - smallR - 16;
      labels.push({ text: g.isl.name, x: gx, y: ly < 12 ? gy + smallR + 26 : ly });
    });
    return { nodes, labels, size };
  }, [persons, islands, islandId]);

  const pos = new Map(layout.nodes.map((n) => [n.p.id, n]));
  const edges: { a: Node; b: Node; cross: boolean }[] = [];
  const seen = new Set<string>();
  for (const n of layout.nodes) {
    for (const id of n.p.linkedPersonIds ?? []) {
      const m = pos.get(id);
      if (!m) continue;
      const key = [n.p.id, id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: n, b: m, cross: n.p.islandId !== m.p.islandId });
    }
  }

  if (layout.nodes.length === 0) return <div className="empty-state">No persons to show yet.</div>;

  const R = islandId ? 9 : 7;
  const dot = (n: Node) => {
    const cats = displayCategories(n.p);
    const colors = cats.length ? cats.map(categoryColor) : ['var(--text-dim)'];
    if (colors.length === 1) return <circle cx={n.x} cy={n.y} r={R} fill={colors[0]} />;
    return colors.map((col, i) => {
      const a0 = (i / colors.length) * 2 * Math.PI - Math.PI / 2;
      const a1 = ((i + 1) / colors.length) * 2 * Math.PI - Math.PI / 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M ${n.x} ${n.y} L ${n.x + R * Math.cos(a0)} ${n.y + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${n.x + R * Math.cos(a1)} ${n.y + R * Math.sin(a1)} Z`;
      return <path key={i} d={d} fill={col} />;
    });
  };

  return (
    <>
      <svg viewBox={`0 0 ${layout.size} ${layout.size}`} width="100%" style={{ maxWidth: 360, display: 'block', margin: '0 auto' }}>
        {edges.map((e, i) => (
          <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
            stroke={e.cross ? 'var(--warn)' : 'var(--text-faint)'} strokeWidth={1.3}
            strokeDasharray={e.cross ? '4 3' : undefined} opacity={0.8} />
        ))}
        {layout.labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="9.5" fontWeight={700} fill="var(--text)">{l.text}</text>
        ))}
        {layout.nodes.map((n) => (
          <g key={n.p.id} onClick={() => setSel(n.p)} style={{ cursor: 'pointer' }}>
            {dot(n)}
            <circle cx={n.x} cy={n.y} r={R} fill="none" stroke="var(--card)" strokeWidth={1.5} />
            {islandId && n.p.islandId !== islandId && (
              <circle cx={n.x} cy={n.y} r={R + 3} fill="none" stroke="var(--warn)" strokeWidth={1} strokeDasharray="2 2" />
            )}
            <text x={n.x} y={n.y + R + 9} textAnchor="middle" fontSize="7.5" fill="var(--text-dim)">{shortLabel(n.p)}</text>
          </g>
        ))}
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', marginTop: 10, fontSize: 11 }}>
        {Object.entries(CATEGORY_COLORS).map(([name, col]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }} /> {name}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="4 3" /></svg> Between islands
        </span>
      </div>

      {sel && (
        <Modal title={displayName(sel)} onClose={() => setSel(null)}>
          {sel.nickname && <div className="section-sub" style={{ margin: 0 }}>"{sel.nickname}"</div>}
          <div className="section-sub">{islandName(sel.islandId)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {displayCategories(sel).map((c) => <Badge key={c} text={c} kind="neutral" />)}
          </div>
          <div className="card-title">Linked Persons</div>
          {(sel.linkedPersonIds ?? []).filter((id) => byId.has(id)).length === 0 && <div className="field-hint">No linked persons.</div>}
          {(sel.linkedPersonIds ?? []).map((id) => {
            const q = byId.get(id);
            if (!q) return null;
            return (
              <div key={id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(q)}>
                <div className="li-main"><div className="li-title">{displayName(q)}</div><div className="li-sub">{islandName(q.islandId)}</div></div>
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
};

export default NetworkMap;

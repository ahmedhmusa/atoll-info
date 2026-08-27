import React, { useState } from 'react';
import { Plus, ChevronRight, Pencil, Trash2, MapPin } from 'lucide-react';
import { useStore } from '../state/store';
import { newId } from '../lib/util';
import Modal from '../components/Modal';
import type { Island } from '../types';

const Islands: React.FC = () => {
  const { data, upsert, remove, clearIslands } = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Island | 'new' | null>(null);

  const rows = data.islands.map((isl) => {
    const here = data.persons.filter((p) => p.islandId === isl.id);
    return {
      island: isl,
      sellers: here.filter((p) => (p.categories ?? []).includes('Dealer')),
      users: here.filter((p) => (p.categories ?? []).includes('Drug User')),
      informants: data.informants.filter((i) => i.islandId === isl.id).length,
      reports: data.reports.filter((r) => r.islandId === isl.id).length,
    };
  });

  const sel = rows.find((r) => r.island.id === selId);

  const doClearAll = async () => {
    if (!confirm(`Remove all ${data.islands.length} islands? Persons, informants, and reports that reference them will show "Unknown Island" until reassigned.`)) return;
    if (!confirm('Are you sure? This cannot be undone.')) return;
    await clearIslands();
  };

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>
      <div className="section-title">Islands</div>
      <div className="section-sub">Suspected sellers and users, tracked separately per island.</div>

      {rows.map((r) => (
        <div key={r.island.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSelId(r.island.id)}>
          <div className="li-main">
            <div className="li-title">{r.island.name}</div>
            <div className="li-sub" style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                {r.sellers.length} sellers
              </span>
              <span style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                {r.users.length} users
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="li-chevron" />
        </div>
      ))}
      {rows.length === 0 && (
        <div className="empty-state">
          <MapPin size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>No islands yet — tap + to add one.</div>
        </div>
      )}

      {rows.length > 0 && (
        <button className="btn btn-danger" style={{ marginTop: 10 }} onClick={doClearAll}>
          Clear All Islands
        </button>
      )}

      {sel && (
        <Modal title={sel.island.name} onClose={() => setSelId(null)}>
          <div className="card-title" style={{ color: 'var(--danger)' }}>Suspected Sellers ({sel.sellers.length})</div>
          {sel.sellers.length === 0 && <div className="empty-state" style={{ padding: '10px 0' }}>None on record.</div>}
          {sel.sellers.map((p) => (
            <div key={p.id} className="kv-row"><span className="k">{p.nickname ? `${p.fullName} "${p.nickname}"` : p.fullName}</span></div>
          ))}
          <div className="card-title" style={{ color: 'var(--accent)', marginTop: 18 }}>Suspected Users ({sel.users.length})</div>
          {sel.users.length === 0 && <div className="empty-state" style={{ padding: '10px 0' }}>None on record.</div>}
          {sel.users.map((p) => (
            <div key={p.id} className="kv-row"><span className="k">{p.nickname ? `${p.fullName} "${p.nickname}"` : p.fullName}</span></div>
          ))}
          <div className="kv-row" style={{ marginTop: 12 }}><span className="k">Informants</span><span className="v">{sel.informants}</span></div>
          <div className="kv-row"><span className="k">Reports</span><span className="v">{sel.reports}</span></div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setEditing(sel.island); setSelId(null); }}><Pencil size={14} /> Rename</button>
            <button
              className="btn btn-danger"
              onClick={() => { if (confirm(`Delete ${sel.island.name}?`)) { remove('islands', sel.island.id); setSelId(null); } }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <IslandForm
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (isl) => { await upsert('islands', isl); setEditing(null); }}
        />
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Add island"><Plus size={24} strokeWidth={2.5} /></button>
    </div>
  );
};

const IslandForm: React.FC<{ existing: Island | null; onClose: () => void; onSave: (isl: Island) => void }> = ({ existing, onClose, onSave }) => {
  const [name, setName] = useState(existing?.name ?? '');

  const save = () => {
    if (!name.trim()) return;
    const record: Island = existing ? { ...existing, name } : { id: newId(), name };
    onSave(record);
  };

  return (
    <Modal title={existing ? 'Rename Island' : 'New Island'} onClose={onClose}>
      <div className="field"><label>Island name *</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <button className="btn btn-primary" onClick={save}>Save Island</button>
    </Modal>
  );
};

export default Islands;

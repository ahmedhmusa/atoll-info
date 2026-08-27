import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronRight, X } from 'lucide-react';
import { useStore, newRecord, touchRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import type { Person, PersonCategory } from '../types';

const CATEGORIES: PersonCategory[] = ['Person of Interest', 'Suspected User', 'Suspected Dealer', 'Cleared'];
const categoryKind = (c: PersonCategory) => (c === 'Suspected Dealer' ? 'danger' : c === 'Suspected User' ? 'accent' : c === 'Cleared' ? 'ok' : 'neutral');

const Persons: React.FC = () => {
  const { data, upsert, remove } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [islandId, setIslandId] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Person | null>(null);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  const islandName = (id: string) => data.islands.find((i) => i.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    return data.persons
      .filter((p) => !islandId || p.islandId === islandId)
      .filter((p) => !category || p.category === category)
      .filter((p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || (p.alias ?? '').toLowerCase().includes(q.toLowerCase()));
  }, [data.persons, islandId, category, q]);

  const clearCategoryFilter = () => { setCategory(''); setSearchParams({}); };

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>
      <div className="section-title">Persons</div>
      <div className="section-sub">{filtered.length} of {data.persons.length} records</div>
      <div className="field"><input placeholder="Search name or alias…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="field">
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          <option value="">All Islands</option>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="field">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {category && (
        <div className="pill-row" style={{ marginBottom: 12 }}>
          <button className="pill active" onClick={clearCategoryFilter} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Showing: {category} <X size={12} />
          </button>
        </div>
      )}

      {filtered.map((p) => (
        <div key={p.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(p)}>
          <div className="li-main">
            <div className="li-title">{p.alias ? `${p.name} "${p.alias}"` : p.name}</div>
            <div className="li-sub">{islandName(p.islandId)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge text={p.category} kind={categoryKind(p.category) as any} />
            <ChevronRight size={18} className="li-chevron" />
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty-state">No persons match this filter — tap + to add one.</div>}

      {sel && (
        <Modal title={sel.name} onClose={() => setSel(null)}>
          <div className="section-sub" style={{ marginBottom: 10 }}>{islandName(sel.islandId)}</div>
          <Badge text={sel.category} kind={categoryKind(sel.category) as any} />
          <div style={{ marginTop: 14, fontSize: 14 }}>{sel.notes || 'No notes.'}</div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setEditing(sel); setSel(null); }}>Edit</button>
            <button className="btn btn-danger" onClick={() => { if (confirm(`Delete ${sel.name}?`)) { remove('persons', sel.id); setSel(null); } }}>Delete</button>
          </div>
        </Modal>
      )}

      {editing && (
        <PersonForm
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (p) => { await upsert('persons', p); setEditing(null); }}
        />
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Add person"><Plus size={24} strokeWidth={2.5} /></button>
    </div>
  );
};

const PersonForm: React.FC<{ existing: Person | null; onClose: () => void; onSave: (p: Person) => void }> = ({ existing, onClose, onSave }) => {
  const { data } = useStore();
  const [name, setName] = useState(existing?.name ?? '');
  const [alias, setAlias] = useState(existing?.alias ?? '');
  const [islandId, setIslandId] = useState(existing?.islandId ?? data.islands[0]?.id ?? '');
  const [category, setCategory] = useState<PersonCategory>(existing?.category ?? 'Person of Interest');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const save = () => {
    if (!name.trim() || !islandId) return;
    const record: Person = existing
      ? touchRecord({ ...existing, name, alias, islandId, category, notes })
      : { ...newRecord(), name, alias, islandId, category, notes };
    onSave(record);
  };

  return (
    <Modal title={existing ? 'Edit Person' : 'New Person'} onClose={onClose}>
      <div className="field"><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label>Alias</label><input value={alias} onChange={(e) => setAlias(e.target.value)} /></div>
      <div className="field">
        <label>Island</label>
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as PersonCategory)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="field"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Save Person</button>
    </Modal>
  );
};

export default Persons;

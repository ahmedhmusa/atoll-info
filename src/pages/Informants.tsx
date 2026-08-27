import React, { useMemo, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useStore, newRecord, touchRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import PhotoField from '../components/PhotoField';
import type { Informant, Level } from '../types';

const LEVELS: Level[] = ['Low', 'Medium', 'High'];
const levelKind = (l: Level) => (l === 'High' ? 'ok' : l === 'Medium' ? 'accent' : 'neutral');

const Informants: React.FC = () => {
  const { data, upsert, remove } = useStore();
  const [islandId, setIslandId] = useState('');
  const [sel, setSel] = useState<Informant | null>(null);
  const [editing, setEditing] = useState<Informant | 'new' | null>(null);

  const islandName = (id: string) => data.islands.find((i) => i.id === id)?.name ?? '—';
  const filtered = useMemo(() => data.informants.filter((i) => !islandId || i.islandId === islandId), [data.informants, islandId]);

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>
      <div className="section-title">Informants</div>
      <div className="section-sub">{filtered.length} of {data.informants.length} sources — code names only, never real identities.</div>
      <div className="field">
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          <option value="">All Islands</option>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      {filtered.map((i) => (
        <div key={i.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(i)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <Avatar src={i.photoDataUrl} />
            <div className="li-main"><div className="li-title">{i.codeName}</div><div className="li-sub">{islandName(i.islandId)}</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge text={`Reliability: ${i.reliability}`} kind={levelKind(i.reliability) as any} />
            <ChevronRight size={18} className="li-chevron" />
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty-state">No informants match this filter — tap + to add one.</div>}

      {sel && (
        <Modal title={sel.codeName} onClose={() => setSel(null)}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <Avatar src={sel.photoDataUrl} size={72} />
            <div className="section-sub" style={{ margin: 0 }}>{islandName(sel.islandId)} · Reliability: {sel.reliability}</div>
          </div>
          <div style={{ fontSize: 14 }}>{sel.notes || 'No notes.'}</div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setEditing(sel); setSel(null); }}>Edit</button>
            <button className="btn btn-danger" onClick={() => { if (confirm(`Delete ${sel.codeName}?`)) { remove('informants', sel.id); setSel(null); } }}>Delete</button>
          </div>
        </Modal>
      )}

      {editing && (
        <InformantForm
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (i) => { await upsert('informants', i); setEditing(null); }}
        />
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Add informant"><Plus size={24} strokeWidth={2.5} /></button>
    </div>
  );
};

const InformantForm: React.FC<{ existing: Informant | null; onClose: () => void; onSave: (i: Informant) => void }> = ({ existing, onClose, onSave }) => {
  const { data } = useStore();
  const [codeName, setCodeName] = useState(existing?.codeName ?? '');
  const [islandId, setIslandId] = useState(existing?.islandId ?? data.islands[0]?.id ?? '');
  const [reliability, setReliability] = useState<Level>(existing?.reliability ?? 'Medium');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState(existing?.photoDataUrl);

  const save = () => {
    if (!codeName.trim() || !islandId) return;
    const record: Informant = existing
      ? touchRecord({ ...existing, codeName, islandId, reliability, notes, photoDataUrl })
      : { ...newRecord(), codeName, islandId, reliability, notes, photoDataUrl };
    onSave(record);
  };

  return (
    <Modal title={existing ? 'Edit Informant' : 'New Informant'} onClose={onClose}>
      <PhotoField value={photoDataUrl} onChange={setPhotoDataUrl} />
      {photoDataUrl && (
        <div className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
          A photo can reveal identity even with a code name on file — handle per your source-protection policy.
        </div>
      )}
      <div className="field"><label>Code name *</label><input value={codeName} onChange={(e) => setCodeName(e.target.value)} placeholder="e.g. BLUE-HERON" autoFocus /></div>
      <div className="field">
        <label>Island</label>
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Reliability</label>
        <select value={reliability} onChange={(e) => setReliability(e.target.value as Level)}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="field"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Save Informant</button>
    </Modal>
  );
};

export default Informants;

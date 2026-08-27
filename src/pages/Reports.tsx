import React, { useMemo, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useStore, newRecord, touchRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { formatDate, todayISO } from '../lib/util';
import type { Report, Level, ReportStatus } from '../types';

const LEVELS: Level[] = ['Low', 'Medium', 'High'];

const Reports: React.FC = () => {
  const { data, upsert, remove } = useStore();
  const [islandId, setIslandId] = useState('');
  const [sel, setSel] = useState<Report | null>(null);
  const [editing, setEditing] = useState<Report | 'new' | null>(null);

  const islandName = (id: string) => data.islands.find((i) => i.id === id)?.name ?? '—';
  const filtered = useMemo(
    () => [...data.reports].filter((r) => !islandId || r.islandId === islandId).sort((a, b) => b.date.localeCompare(a.date)),
    [data.reports, islandId]
  );

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>
      <div className="section-title">Reports</div>
      <div className="section-sub">{filtered.length} of {data.reports.length} on record</div>
      <div className="field">
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          <option value="">All Islands</option>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      {filtered.map((r) => (
        <div key={r.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(r)}>
          <div className="li-main"><div className="li-title">{r.title}</div><div className="li-sub">{islandName(r.islandId)} · {formatDate(r.date)} · Confidence: {r.confidence}</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge text={r.status} kind={r.status === 'Open' ? 'accent' : 'ok'} />
            <ChevronRight size={18} className="li-chevron" />
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty-state">No reports match this filter — tap + to add one.</div>}

      {sel && (
        <Modal title={sel.title} onClose={() => setSel(null)}>
          <div className="section-sub" style={{ marginBottom: 10 }}>{islandName(sel.islandId)} · {formatDate(sel.date)} · Confidence: {sel.confidence}</div>
          <Badge text={sel.status} kind={sel.status === 'Open' ? 'accent' : 'ok'} />
          <div style={{ marginTop: 14, fontSize: 14 }}>{sel.description || 'No description.'}</div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setEditing(sel); setSel(null); }}>Edit</button>
            <button className="btn btn-danger" onClick={() => { if (confirm(`Delete "${sel.title}"?`)) { remove('reports', sel.id); setSel(null); } }}>Delete</button>
          </div>
        </Modal>
      )}

      {editing && (
        <ReportForm
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (r) => { await upsert('reports', r); setEditing(null); }}
        />
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Add report"><Plus size={24} strokeWidth={2.5} /></button>
    </div>
  );
};

const ReportForm: React.FC<{ existing: Report | null; onClose: () => void; onSave: (r: Report) => void }> = ({ existing, onClose, onSave }) => {
  const { data } = useStore();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [islandId, setIslandId] = useState(existing?.islandId ?? data.islands[0]?.id ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [confidence, setConfidence] = useState<Level>(existing?.confidence ?? 'Medium');
  const [status, setStatus] = useState<ReportStatus>(existing?.status ?? 'Open');
  const [description, setDescription] = useState(existing?.description ?? '');

  const save = () => {
    if (!title.trim() || !islandId) return;
    const record: Report = existing
      ? touchRecord({ ...existing, title, islandId, date, confidence, status, description })
      : { ...newRecord(), title, islandId, date, confidence, status, description };
    onSave(record);
  };

  return (
    <Modal title={existing ? 'Edit Report' : 'New Report'} onClose={onClose}>
      <div className="field"><label>Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="field">
        <label>Island</label>
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field">
        <label>Confidence</label>
        <select value={confidence} onChange={(e) => setConfidence(e.target.value as Level)}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
          <option>Open</option><option>Closed</option>
        </select>
      </div>
      <div className="field"><label>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Save Report</button>
    </Modal>
  );
};

export default Reports;

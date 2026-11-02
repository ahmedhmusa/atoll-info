import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserX, ShieldAlert, Radio, FileText, Users, CheckSquare, Plus } from 'lucide-react';
import { useStore, newRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { formatDate, todayISO } from '../lib/util';
import NetworkMap from '../components/NetworkMap';
import type { TaskItem, TaskPriority } from '../types';

const Dashboard: React.FC = () => {
  const { data, settings, upsert } = useStore();
  const navigate = useNavigate();
  const [islandId, setIslandId] = useState<string>('');
  const [adding, setAdding] = useState(false);

  const byIsland = <T extends { islandId?: string }>(list: T[]) => (islandId ? list.filter((x) => x.islandId === islandId) : list);
  const fp = islandId ? data.persons.filter((p) => p.islandId === islandId || p.presentIslandId === islandId) : data.persons;
  const fi = byIsland(data.informants);
  const fr = byIsland(data.reports);
  const dealers = fp.filter((p) => (p.categories ?? []).includes('Dealer'));
  const drugUsers = fp.filter((p) => (p.categories ?? []).includes('Drug User'));
  const openTasks = data.tasks.filter((t) => !t.done);
  const recentReports = [...fr].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const StatTile: React.FC<{ n: number; label: string; color: string; Icon: React.ElementType; onClick: () => void }> = ({ n, label, color, Icon, onClick }) => (
    <button className="stat-tile" onClick={onClick} aria-label={`${label}: ${n}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="tile-icon" style={{ background: color }}><Icon size={17} strokeWidth={2.4} /></span>
        <div className="num">{n}</div>
      </div>
      <div className="label">{label}</div>
    </button>
  );

  const islandLabel = islandId ? data.islands.find((i) => i.id === islandId)?.name : 'All Islands';

  return (
    <div>
      <div className="section-title">Dashboard</div>
      <div className="section-sub">{settings?.agencyLabel || 'Tha Atoll'}</div>

      <div className="field">
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)} aria-label="Island">
          <option value="">All Islands</option>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatTile n={dealers.length} label="Dealers" color="var(--danger)" Icon={ShieldAlert}
          onClick={() => navigate('/persons?category=' + encodeURIComponent('Dealer'))} />
        <StatTile n={drugUsers.length} label="Drug Users" color="var(--accent)" Icon={UserX}
          onClick={() => navigate('/persons?category=' + encodeURIComponent('Drug User'))} />
        <StatTile n={fp.length} label="All Persons" color="var(--indigo)" Icon={Users} onClick={() => navigate('/persons')} />
        <StatTile n={fi.length} label="Informants" color="var(--ok)" Icon={Radio} onClick={() => navigate('/informants')} />
        <StatTile n={fr.length} label="Reports" color="var(--purple)" Icon={FileText} onClick={() => navigate('/reports')} />
        <StatTile n={openTasks.length} label="Open Tasks" color="var(--warn)" Icon={CheckSquare} onClick={() => navigate('/tasks')} />
      </div>

      <div className="card-title">Drug Network · {islandLabel}</div>
      <div className="card" style={{ padding: 8 }}>
        <NetworkMap persons={data.persons} islands={data.islands} islandId={islandId} />
      </div>

      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginRight: 4 }}>
        <span>Open Tasks</span>
        <button className="btn-ghost" onClick={() => setAdding(true)} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 600, textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}>
          <Plus size={17} strokeWidth={2.5} /> Add
        </button>
      </div>
      <div className="card" style={{ padding: 8 }}>
        {openTasks.length === 0 && <div className="empty-state">No open tasks.</div>}
        {openTasks.slice(0, 5).map((t) => (
          <Link key={t.id} to="/tasks" className="list-item">
            <div className="li-main"><div className="li-title">{t.title}</div><div className="li-sub">Due {t.due ? formatDate(t.due) : '—'}</div></div>
            <Badge text={t.priority} kind={t.priority === 'High' ? 'danger' : 'neutral'} />
          </Link>
        ))}
      </div>

      <div className="card-title">Recent Reports</div>
      <div className="card" style={{ padding: 8 }}>
        {recentReports.length === 0 && <div className="empty-state">No reports yet.</div>}
        {recentReports.map((r) => (
          <Link key={r.id} to="/reports" className="list-item">
            <div className="li-main"><div className="li-title">{r.title}</div><div className="li-sub">{formatDate(r.date)}</div></div>
            <Badge text={r.status} kind={r.status === 'Open' ? 'accent' : 'ok'} />
          </Link>
        ))}
      </div>

      {adding && <QuickTaskForm onClose={() => setAdding(false)} onSave={async (t) => { await upsert('tasks', t); setAdding(false); }} />}
    </div>
  );
};

const QuickTaskForm: React.FC<{ onClose: () => void; onSave: (t: TaskItem) => void }> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayISO());
  const [priority, setPriority] = useState<TaskPriority>('Medium');

  return (
    <Modal title="Add Task" onClose={onClose}>
      <div className="field"><label>Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label>Due date</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      <div className="field">
        <label>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          {(['Low', 'Medium', 'High'] as TaskPriority[]).map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={() => { if (!title.trim()) return; onSave({ ...newRecord(), title, due, priority, done: false }); }}>
        Save Task
      </button>
    </Modal>
  );
};

export default Dashboard;

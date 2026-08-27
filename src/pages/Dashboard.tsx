import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserX, ShieldAlert, Radio, FileText, Users, CheckSquare, Plus } from 'lucide-react';
import { useStore, newRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { formatDate, todayISO } from '../lib/util';
import type { TaskItem, TaskPriority } from '../types';

const Dashboard: React.FC = () => {
  const { data, settings, upsert } = useStore();
  const navigate = useNavigate();
  const [islandId, setIslandId] = useState<string>('');
  const [adding, setAdding] = useState(false);

  const byIsland = <T extends { islandId?: string }>(list: T[]) => (islandId ? list.filter((x) => x.islandId === islandId) : list);
  const fp = byIsland(data.persons);
  const fi = byIsland(data.informants);
  const fr = byIsland(data.reports);
  const sellers = fp.filter((p) => p.category === 'Suspected Dealer');
  const users = fp.filter((p) => p.category === 'Suspected User');
  const openTasks = data.tasks.filter((t) => !t.done);
  const recentReports = [...fr].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const StatTile: React.FC<{ n: number; label: string; hint: string; color: string; Icon: React.ElementType; onClick: () => void }> = ({ n, label, hint, color, Icon, onClick }) => (
    <button className="stat-tile" onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer' }} title={hint}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="num" style={{ color }}>{n}</div>
        <Icon size={16} style={{ color, opacity: 0.85, marginTop: 2 }} />
      </div>
      <div className="label">{label}</div>
      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3, lineHeight: 1.3 }}>{hint}</div>
    </button>
  );

  return (
    <div>
      <div className="section-title">Dashboard</div>
      <div className="section-sub">{settings?.agencyLabel}</div>

      <div className="field">
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          <option value="">All Islands</option>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      <div className="stat-grid" style={{ marginBottom: 10 }}>
        <StatTile
          n={sellers.length} label="Suspected Sellers" hint="Persons flagged as Suspected Dealer" color="var(--danger)" Icon={ShieldAlert}
          onClick={() => navigate('/persons?category=' + encodeURIComponent('Suspected Dealer'))}
        />
        <StatTile
          n={users.length} label="Suspected Users" hint="Persons flagged as Suspected User" color="var(--accent)" Icon={UserX}
          onClick={() => navigate('/persons?category=' + encodeURIComponent('Suspected User'))}
        />
        <StatTile
          n={fi.length} label="Informants" hint="Confidential sources on record" color="var(--text)" Icon={Radio}
          onClick={() => navigate('/informants')}
        />
        <StatTile
          n={fr.length} label="Reports" hint="All intelligence reports logged" color="var(--text)" Icon={FileText}
          onClick={() => navigate('/reports')}
        />
      </div>
      <div className="stat-grid">
        <StatTile
          n={fp.length} label="Total Persons" hint="Every person record, any category" color="var(--text)" Icon={Users}
          onClick={() => navigate('/persons')}
        />
        <StatTile
          n={openTasks.length} label="Open Tasks" hint="Follow-ups not yet marked done" color="var(--text)" Icon={CheckSquare}
          onClick={() => navigate('/tasks')}
        />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Recent Reports</div>
        {recentReports.length === 0 && <div className="empty-state">No reports yet.</div>}
        {recentReports.map((r) => (
          <Link key={r.id} to="/reports" className="list-item">
            <div className="li-main"><div className="li-title">{r.title}</div><div className="li-sub">{formatDate(r.date)}</div></div>
            <Badge text={r.status} kind={r.status === 'Open' ? 'accent' : 'ok'} />
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Open Tasks</div>
        {openTasks.length === 0 && <div className="empty-state">No open tasks.</div>}
        {openTasks.slice(0, 5).map((t) => (
          <Link key={t.id} to="/tasks" className="list-item">
            <div className="li-main"><div className="li-title">{t.title}</div><div className="li-sub">Due {t.due ? formatDate(t.due) : '—'}</div></div>
            <Badge text={t.priority} kind={t.priority === 'High' ? 'danger' : 'neutral'} />
          </Link>
        ))}
        <button className="btn btn-primary" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setAdding(true)}>
          <Plus size={16} strokeWidth={2.5} /> Add Task
        </button>
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
      <div className="field"><label>Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
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

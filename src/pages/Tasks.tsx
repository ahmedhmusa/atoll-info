import React, { useState } from 'react';
import { useStore, newRecord, touchRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { formatDate, todayISO } from '../lib/util';
import type { TaskItem, TaskPriority } from '../types';

const LEVELS: TaskPriority[] = ['Low', 'Medium', 'High'];

const Tasks: React.FC = () => {
  const { data, upsert, remove } = useStore();
  const [adding, setAdding] = useState(false);

  const sorted = [...data.tasks].sort((a, b) => (a.done === b.done ? (a.due ?? '9999').localeCompare(b.due ?? '9999') : a.done ? 1 : -1));

  const toggle = (t: TaskItem) => upsert('tasks', touchRecord({ ...t, done: !t.done }));

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>
      <div className="section-title">Tasks</div>
      <div className="section-sub">Tap a task to mark done / reopen. Long-press style delete via the ✕.</div>

      {sorted.map((t) => (
        <div key={t.id} className="list-item">
          <div className="li-main" style={{ cursor: 'pointer' }} onClick={() => toggle(t)}>
            <div className="li-title" style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-faint)' : 'var(--text)' }}>
              {t.done ? '☑' : '☐'} {t.title}
            </div>
            <div className="li-sub">Due {t.due ? formatDate(t.due) : '—'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge text={t.priority} kind={t.priority === 'High' ? 'danger' : t.priority === 'Medium' ? 'accent' : 'neutral'} />
            <button className="icon-btn" onClick={() => remove('tasks', t.id)}>✕</button>
          </div>
        </div>
      ))}
      {sorted.length === 0 && <div className="empty-state">No tasks yet — tap + to add one.</div>}

      {adding && (
        <TaskForm onClose={() => setAdding(false)} onSave={async (t) => { await upsert('tasks', t); setAdding(false); }} />
      )}
      <button className="fab" onClick={() => setAdding(true)} aria-label="Add task">+</button>
    </div>
  );
};

const TaskForm: React.FC<{ onClose: () => void; onSave: (t: TaskItem) => void }> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayISO());
  const [priority, setPriority] = useState<TaskPriority>('Medium');

  return (
    <Modal title="New Task" onClose={onClose}>
      <div className="field"><label>Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="field"><label>Due date</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      <div className="field">
        <label>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={() => { if (!title.trim()) return; onSave({ ...newRecord(), title, due, priority, done: false }); }}>
        Save Task
      </button>
    </Modal>
  );
};

export default Tasks;

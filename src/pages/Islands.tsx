import React, { useState } from 'react';
import { useStore } from '../state/store';
import Modal from '../components/Modal';

const Islands: React.FC = () => {
  const { data } = useStore();
  const [selId, setSelId] = useState<string | null>(null);

  const rows = data.islands.map((isl) => {
    const here = data.persons.filter((p) => p.islandId === isl.id);
    return {
      island: isl,
      sellers: here.filter((p) => p.category === 'Suspected Dealer'),
      users: here.filter((p) => p.category === 'Suspected User'),
      informants: data.informants.filter((i) => i.islandId === isl.id).length,
      reports: data.reports.filter((r) => r.islandId === isl.id).length,
    };
  });

  const sel = rows.find((r) => r.island.id === selId);

  return (
    <div>
      <div className="section-title">Islands</div>
      <div className="section-sub">Suspected sellers and users, tracked separately per island.</div>
      {rows.map((r) => (
        <button key={r.island.id} className="list-item" style={{ width: '100%', textAlign: 'left', border: '1px solid var(--border)' }} onClick={() => setSelId(r.island.id)}>
          <div className="li-main">
            <div className="li-title">{r.island.name}</div>
            <div className="li-sub" style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>● {r.sellers.length} sellers</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>● {r.users.length} users</span>
            </div>
          </div>
          <div className="li-chevron">›</div>
        </button>
      ))}

      {sel && (
        <Modal title={sel.island.name} onClose={() => setSelId(null)}>
          <div className="card-title" style={{ color: 'var(--danger)' }}>Suspected Sellers ({sel.sellers.length})</div>
          {sel.sellers.length === 0 && <div className="empty-state" style={{ padding: '10px 0' }}>None on record.</div>}
          {sel.sellers.map((p) => (
            <div key={p.id} className="kv-row"><span className="k">{p.alias ? `${p.name} "${p.alias}"` : p.name}</span></div>
          ))}
          <div className="card-title" style={{ color: 'var(--accent)', marginTop: 18 }}>Suspected Users ({sel.users.length})</div>
          {sel.users.length === 0 && <div className="empty-state" style={{ padding: '10px 0' }}>None on record.</div>}
          {sel.users.map((p) => (
            <div key={p.id} className="kv-row"><span className="k">{p.alias ? `${p.name} "${p.alias}"` : p.name}</span></div>
          ))}
          <div className="kv-row" style={{ marginTop: 12 }}><span className="k">Informants</span><span className="v">{sel.informants}</span></div>
          <div className="kv-row"><span className="k">Reports</span><span className="v">{sel.reports}</span></div>
        </Modal>
      )}
    </div>
  );
};

export default Islands;

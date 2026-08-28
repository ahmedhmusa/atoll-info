import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronRight, X, Expand } from 'lucide-react';
import { useStore, newRecord, touchRecord } from '../state/store';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';
import PhotoField from '../components/PhotoField';
import PhotoLightbox from '../components/PhotoLightbox';
import { formatDate } from '../lib/util';
import type { Person, PersonCategory, DrugType, FlagStatus } from '../types';

const CATEGORIES: PersonCategory[] = ['Dealer', 'Drug User', 'Person of Interest'];
const DRUG_TYPES: DrugType[] = ['Cocaine', 'Heroin', 'Cannabis', 'Party Drugs', 'Alcohol', 'Meth'];
const FLAG_STATUSES: FlagStatus[] = ['None', 'Jailed', 'Faruvaa', 'On-Watch', 'On Investigation'];

const categoryKind = (c: PersonCategory) => (c === 'Dealer' ? 'danger' : c === 'Drug User' ? 'accent' : 'neutral');
const flagKind = (f: FlagStatus) => (f === 'Jailed' ? 'danger' : f === 'On-Watch' || f === 'On Investigation' ? 'accent' : f === 'Faruvaa' ? 'danger' : 'neutral');

// Defensive fallback for any record saved under the previous, simpler
// person shape (single `name`/`category`) so old data doesn't crash the UI.
function displayName(p: any): string {
  return p.fullName || p.name || 'Unnamed';
}
function displayCategories(p: any): PersonCategory[] {
  if (Array.isArray(p.categories)) return p.categories;
  if (p.category) return [p.category];
  return [];
}

const Persons: React.FC = () => {
  const { data, upsert, remove } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [islandId, setIslandId] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Person | null>(null);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);

  const islandName = (id: string) => data.islands.find((i) => i.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    return data.persons
      .filter((p) => !islandId || p.islandId === islandId)
      .filter((p) => !category || displayCategories(p).includes(category as PersonCategory))
      .filter((p) => {
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return displayName(p).toLowerCase().includes(s) || (p.nickname ?? '').toLowerCase().includes(s) || (p.idCardNumber ?? '').toLowerCase().includes(s);
      });
  }, [data.persons, islandId, category, q]);

  const clearCategoryFilter = () => { setCategory(''); setSearchParams({}); };

  return (
    <div style={{ position: 'relative', minHeight: '60vh' }}>
      <div className="section-title">Persons</div>
      <div className="section-sub">{filtered.length} of {data.persons.length} records</div>
      <div className="field"><input placeholder="Search name, nickname, or ID number…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <Avatar src={p.photoDataUrl} />
            <div className="li-main">
              <div className="li-title">{displayName(p)}{p.nickname ? ` "${p.nickname}"` : ''}</div>
              <div className="li-sub">{islandName(p.islandId)}{p.flagStatus && p.flagStatus !== 'None' ? ` · ${p.flagStatus}` : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {displayCategories(p).slice(0, 1).map((c) => <Badge key={c} text={c} kind={categoryKind(c) as any} />)}
            {displayCategories(p).length > 1 && <Badge text={`+${displayCategories(p).length - 1}`} kind="neutral" />}
            <ChevronRight size={18} className="li-chevron" />
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty-state">No persons match this filter — tap + to add one.</div>}

      {sel && (
        <Modal title={displayName(sel)} onClose={() => setSel(null)}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => sel.photoDataUrl && setLightbox({ src: sel.photoDataUrl, title: 'Photo' })}
              style={{ padding: 0, border: 'none', background: 'none', cursor: sel.photoDataUrl ? 'zoom-in' : 'default', position: 'relative' }}
            >
              <Avatar src={sel.photoDataUrl} size={72} />
              {sel.photoDataUrl && <Expand size={11} style={{ position: 'absolute', bottom: 2, right: 2, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: 2 }} />}
            </button>
            {sel.idPhotoDataUrl && (
              <button
                type="button"
                onClick={() => setLightbox({ src: sel.idPhotoDataUrl!, title: 'ID Card' })}
                style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', position: 'relative' }}
              >
                <Avatar src={sel.idPhotoDataUrl} size={72} />
                <Expand size={11} style={{ position: 'absolute', bottom: 2, right: 2, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: 2 }} />
              </button>
            )}
            <div style={{ flex: 1 }}>
              {sel.nickname && <div className="section-sub" style={{ margin: 0 }}>"{sel.nickname}"</div>}
              <div className="section-sub" style={{ margin: 0 }}>{islandName(sel.islandId)}</div>
              {sel.idCardNumber && <div className="section-sub" style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>ID: {sel.idCardNumber}</div>}
            </div>
          </div>

          {(sel.dateOfBirth || sel.address || sel.contactNumber) && (
            <>
              {sel.dateOfBirth && <div className="kv-row"><span className="k">Date of birth</span><span className="v">{formatDate(sel.dateOfBirth)}</span></div>}
              {sel.contactNumber && <div className="kv-row"><span className="k">Contact number</span><span className="v">{sel.contactNumber}</span></div>}
              {sel.address && <div className="kv-row"><span className="k">Address</span><span className="v">{sel.address}</span></div>}
            </>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {displayCategories(sel).map((c) => <Badge key={c} text={c} kind={categoryKind(c) as any} />)}
            {sel.flagStatus && sel.flagStatus !== 'None' && <Badge text={sel.flagStatus} kind={flagKind(sel.flagStatus) as any} />}
          </div>

          {sel.drugTypes && sel.drugTypes.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 12 }}>Types of Drugs</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sel.drugTypes.map((d) => <Badge key={d} text={d} kind="neutral" />)}
              </div>
            </>
          )}

          {sel.networkConnections && (
            <>
              <div className="card-title" style={{ marginTop: 14 }}>Drug Network Connections</div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{sel.networkConnections}</div>
            </>
          )}

          <div className="card-title" style={{ marginTop: 14 }}>Notes</div>
          <div style={{ fontSize: 14 }}>{sel.notes || 'No notes.'}</div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setEditing(sel); setSel(null); }}>Edit</button>
            <button className="btn btn-danger" onClick={() => { if (confirm(`Delete ${displayName(sel)}?`)) { remove('persons', sel.id); setSel(null); } }}>Delete</button>
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

      {lightbox && <PhotoLightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Add person"><Plus size={24} strokeWidth={2.5} /></button>
    </div>
  );
};

const TogglePills: React.FC<{ options: string[]; selected: string[]; onToggle: (v: string) => void }> = ({ options, selected, onToggle }) => (
  <div className="pill-row" style={{ flexWrap: 'wrap' }}>
    {options.map((opt) => (
      <button key={opt} type="button" className={`pill ${selected.includes(opt) ? 'active' : ''}`} onClick={() => onToggle(opt)}>
        {opt}
      </button>
    ))}
  </div>
);

const PersonForm: React.FC<{ existing: Person | null; onClose: () => void; onSave: (p: Person) => void }> = ({ existing, onClose, onSave }) => {
  const { data } = useStore();
  const [fullName, setFullName] = useState(existing ? displayName(existing) : '');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [idCardNumber, setIdCardNumber] = useState(existing?.idCardNumber ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(existing?.dateOfBirth ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [contactNumber, setContactNumber] = useState(existing?.contactNumber ?? '');
  const [islandId, setIslandId] = useState(existing?.islandId ?? data.islands[0]?.id ?? '');
  const [categories, setCategories] = useState<PersonCategory[]>(existing ? displayCategories(existing) : []);
  const [drugTypes, setDrugTypes] = useState<DrugType[]>(existing?.drugTypes ?? []);
  const [networkConnections, setNetworkConnections] = useState(existing?.networkConnections ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [flagStatus, setFlagStatus] = useState<FlagStatus>(existing?.flagStatus ?? 'None');
  const [photoDataUrl, setPhotoDataUrl] = useState(existing?.photoDataUrl);
  const [idPhotoDataUrl, setIdPhotoDataUrl] = useState(existing?.idPhotoDataUrl);

  const toggleCategory = (c: string) => setCategories((l) => (l.includes(c as PersonCategory) ? l.filter((v) => v !== c) : [...l, c as PersonCategory]));
  const toggleDrug = (d: string) => setDrugTypes((l) => (l.includes(d as DrugType) ? l.filter((v) => v !== d) : [...l, d as DrugType]));

  const save = () => {
    if (!fullName.trim() || !islandId) return;
    const base = { fullName, nickname, idCardNumber, dateOfBirth, address, contactNumber, islandId, categories, drugTypes, networkConnections, notes, flagStatus, photoDataUrl, idPhotoDataUrl };
    const record: Person = existing ? touchRecord({ ...existing, ...base }) : { ...newRecord(), ...base };
    onSave(record);
  };

  return (
    <Modal title={existing ? 'Edit Person' : 'New Person'} onClose={onClose}>
      <PhotoField label="Full Photo" value={photoDataUrl} onChange={setPhotoDataUrl} maxDim={640} />
      <PhotoField label="ID Card Photo" value={idPhotoDataUrl} onChange={setIdPhotoDataUrl} maxDim={900} />

      <div className="field"><label>Full Name *</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus /></div>
      <div className="field"><label>Nick Name</label><input value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
      <div className="field"><label>ID Card Number</label><input value={idCardNumber} onChange={(e) => setIdCardNumber(e.target.value)} /></div>
      <div className="field"><label>Date of Birth</label><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></div>
      <div className="field"><label>Address</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></div>
      <div className="field"><label>Contact Number</label><input type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g. +960 7XX XXXX" /></div>
      <div className="field">
        <label>Island *</label>
        <select value={islandId} onChange={(e) => setIslandId(e.target.value)}>
          {data.islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Category (select any that apply)</label>
        <TogglePills options={CATEGORIES} selected={categories} onToggle={toggleCategory} />
      </div>

      <div className="field">
        <label>Types of Drugs (select any that apply)</label>
        <TogglePills options={DRUG_TYPES} selected={drugTypes} onToggle={toggleDrug} />
      </div>

      <div className="field">
        <label>Drug Network Connections</label>
        <textarea value={networkConnections} onChange={(e) => setNetworkConnections(e.target.value)} placeholder="e.g. supplies from X, works with Y…" />
      </div>

      <div className="field">
        <label>Flag Status</label>
        <select value={flagStatus} onChange={(e) => setFlagStatus(e.target.value as FlagStatus)}>
          {FLAG_STATUSES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="field"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <button className="btn btn-primary" onClick={save}>Save Person</button>
    </Modal>
  );
};

export default Persons;

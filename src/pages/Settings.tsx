import React, { useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { InspectResult, RestoreSummary } from '../lib/backup';
import { formatDate } from '../lib/util';
import { APP_VERSION, SCHEMA_VERSION } from '../lib/appMeta';

const TIMEOUTS = [1, 2, 5, 10, 15, 30];

const Settings: React.FC = () => {
  const { settings, updateSettings, changePin, lock, wipeAllData, locked, exportBackup, inspectBackup, restoreFromBackup } = useStore();
  const [officerCallsign, setOfficerCallsign] = useState(settings?.officerCallsign ?? '');
  const [agencyLabel, setAgencyLabel] = useState(settings?.agencyLabel ?? '');
  const [timeout, setTimeoutMin] = useState(settings?.inactivityTimeoutMinutes ?? 5);

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const saveGeneral = () => updateSettings({ officerCallsign, agencyLabel, inactivityTimeoutMinutes: timeout });

  const submitPinChange = async () => {
    setPinMsg(null);
    if (newPin.length < 6) { setPinMsg('New PIN must be at least 6 characters.'); return; }
    if (newPin !== confirmPin) { setPinMsg('New PIN and confirmation do not match.'); return; }
    setPinBusy(true);
    const ok = await changePin(oldPin, newPin);
    setPinBusy(false);
    if (ok) { setPinMsg('PIN changed successfully.'); setOldPin(''); setNewPin(''); setConfirmPin(''); }
    else setPinMsg('Current PIN is incorrect.');
  };

  const doWipe = async () => {
    if (confirm('This permanently deletes all persons, informants, reports, and tasks on this device. Continue?')) {
      await wipeAllData();
      alert('All operational data has been wiped.');
    }
  };

  // -- Backup & Restore ------------------------------------------------
  const [exportPin, setExportPin] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<InspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [restorePin, setRestorePin] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const [confirming, setConfirming] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<RestoreSummary | null>(null);

  const doExport = async () => {
    if (!exportPin) { setExportMsg('Enter your PIN to authorize export.'); return; }
    setExportBusy(true); setExportMsg(null);
    try {
      const blob = await exportBackup(exportPin);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atoll-info-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setExportMsg('Backup downloaded. Save it to Files, iCloud Drive, Google Drive, or a USB drive — it is never uploaded automatically.');
      setExportPin('');
    } catch (e: any) {
      setExportMsg(e?.message ?? 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  };

  const onFileChosen = async (file: File | null) => {
    setPendingFile(file); setInspection(null); setRestoreMsg(null); setSummary(null); setConfirming(false);
    if (!file) return;
    setInspecting(true);
    setInspection(await inspectBackup(file));
    setInspecting(false);
  };

  const doRestore = async () => {
    if (!pendingFile || !restorePin) return;
    setRestoreBusy(true); setRestoreMsg(null);
    const res = await restoreFromBackup(pendingFile, restorePin, mode);
    setRestoreBusy(false); setRestoreMsg(res.message); setConfirming(false);
    if (res.ok) {
      setSummary(res.summary ?? null);
      setRestorePin('');
      if (mode === 'replace') { setPendingFile(null); setInspection(null); if (fileRef.current) fileRef.current.value = ''; }
    }
  };

  return (
    <div>
      <div className="section-title">Settings</div>
      <div className="section-sub">Stored locally on this device only.</div>

      <div className="card">
        <div className="card-title">Officer & Agency</div>
        <div className="field"><label>Officer callsign</label><input value={officerCallsign} onChange={(e) => setOfficerCallsign(e.target.value)} /></div>
        <div className="field"><label>Agency label</label><input value={agencyLabel} onChange={(e) => setAgencyLabel(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={saveGeneral}>Save</button>
      </div>

      <div className="card">
        <div className="card-title">Auto-Lock</div>
        <div className="field">
          <label>Lock after inactivity</label>
          <select value={timeout} onChange={(e) => setTimeoutMin(Number(e.target.value))}>
            {TIMEOUTS.map((m) => <option key={m} value={m}>{m} minute{m > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={saveGeneral}>Save</button>
        <button className="btn" style={{ marginTop: 10 }} onClick={lock}>Lock Now</button>
      </div>

      <div className="card">
        <div className="card-title">Change PIN</div>
        <div className="field"><label>Current PIN</label><input type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} /></div>
        <div className="field"><label>New PIN</label><input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} /></div>
        <div className="field"><label>Confirm new PIN</label><input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={submitPinChange} disabled={pinBusy}>{pinBusy ? 'Updating…' : 'Change PIN'}</button>
        {pinMsg && <div className="section-sub" style={{ marginTop: 10, marginBottom: 0 }}>{pinMsg}</div>}
      </div>

      <div className="card">
        <div className="card-title">About</div>
        <div className="kv-row"><span className="k">App version</span><span className="v">{APP_VERSION}</span></div>
        <div className="kv-row"><span className="k">Database version</span><span className="v">{SCHEMA_VERSION}</span></div>
        <div className="kv-row"><span className="k">Storage</span><span className="v">IndexedDB (on this device)</span></div>
        <div className="kv-row"><span className="k">Encryption</span><span className="v">AES-GCM / PBKDF2-SHA256</span></div>
        <div className="kv-row"><span className="k">Network use</span><span className="v">None — fully offline</span></div>
      </div>

      <div className="card">
        <div className="card-title">Export Backup</div>
        <div className="section-sub">Includes persons, informants, reports, tasks, islands, and settings. Saved as a file only you control — never uploaded.</div>
        <div className="field"><label>Current PIN</label><input type="password" value={exportPin} onChange={(e) => setExportPin(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={doExport} disabled={exportBusy}>{exportBusy ? 'Encrypting…' : 'Export Encrypted Backup'}</button>
        {exportMsg && <div className="section-sub" style={{ marginTop: 10, marginBottom: 0 }}>{exportMsg}</div>}
      </div>

      <div className="card">
        <div className="card-title">Restore From Backup</div>
        <div className="field"><label>Backup file (.json)</label><input ref={fileRef} type="file" accept="application/json" onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)} /></div>

        {inspecting && <div className="section-sub">Reading file…</div>}

        {inspection && !inspection.ok && (
          <div className="warning-box">
            {{
              unreadable: 'This file could not be read — it may be corrupted or not a valid file.',
              'not-atoll-backup': 'This is not a recognized Atoll Info backup file.',
              'unsupported-version': 'This backup was made by a newer, incompatible version of the app.',
            }[inspection.reason]}
          </div>
        )}

        {inspection && inspection.ok && (
          <div style={{ background: 'var(--card2)', borderRadius: 'var(--radius)', padding: 12, marginTop: 4 }}>
            {!inspection.checksumOk && <div className="warning-box">Integrity check failed — this file may be corrupted. Restoring is not recommended.</div>}
            <div className="kv-row"><span className="k">Created</span><span className="v">{formatDate(inspection.file.createdAt)}</span></div>
            <div className="kv-row"><span className="k">App / DB version</span><span className="v">{inspection.file.appVersion} / {inspection.file.dbVersion}</span></div>
            <div className="kv-row"><span className="k">Persons</span><span className="v">{inspection.file.recordCounts.persons}</span></div>
            <div className="kv-row"><span className="k">Informants</span><span className="v">{inspection.file.recordCounts.informants}</span></div>
            <div className="kv-row"><span className="k">Reports</span><span className="v">{inspection.file.recordCounts.reports}</span></div>
            <div className="kv-row"><span className="k">Tasks</span><span className="v">{inspection.file.recordCounts.tasks}</span></div>
            <div className="kv-row"><span className="k">Islands</span><span className="v">{inspection.file.recordCounts.islands}</span></div>

            {!summary ? (
              <>
                <div className="field" style={{ marginTop: 14 }}>
                  <label>Restore mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'merge')}>
                    <option value="merge">Merge — add only new records, never overwrite</option>
                    <option value="replace">Full restore — replace everything on this device</option>
                  </select>
                </div>
                <div className="field"><label>Backup password</label><input type="password" value={restorePin} onChange={(e) => setRestorePin(e.target.value)} /></div>
                {mode === 'merge' && locked && <div className="warning-box">Unlock the app first — merging needs an active session.</div>}
                {!confirming ? (
                  <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={!restorePin || (mode === 'merge' && locked) || !inspection.checksumOk}>
                    Continue
                  </button>
                ) : (
                  <div className="warning-box">
                    <div style={{ marginBottom: 10, fontWeight: 700 }}>
                      {mode === 'replace' ? 'This erases everything currently on this device and replaces it with this backup. This cannot be undone.' : "This adds any records from the backup that don't already exist. Nothing existing is changed."}
                    </div>
                    <div className="btn-row">
                      <button className="btn btn-danger" onClick={doRestore} disabled={restoreBusy}>{restoreBusy ? 'Restoring…' : `Yes, ${mode === 'replace' ? 'replace' : 'merge'}`}</button>
                      <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                {Object.entries(summary.added).map(([store, count]) => (
                  <div key={store} className="kv-row">
                    <span className="k">{store}</span>
                    <span className="v">+{count}{summary.skipped[store as keyof typeof summary.skipped] ? ` (${summary.skipped[store as keyof typeof summary.skipped]} already existed)` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {restoreMsg && <div className="section-sub" style={{ marginTop: 10, marginBottom: 0 }}>{restoreMsg}</div>}
      </div>

      <div className="card">
        <div className="card-title">Danger Zone</div>
        <div className="section-sub">Permanently erase all persons, informants, reports, and tasks. Islands and settings are kept.</div>
        <button className="btn btn-danger" onClick={doWipe}>Wipe All Data</button>
      </div>

      <div className="warning-box">
        FOR AUTHORIZED OFFICIAL USE ONLY. This app never transmits data anywhere. Losing your PIN means data cannot be recovered.
      </div>
    </div>
  );
};

export default Settings;

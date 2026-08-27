import React, { useState } from 'react';
import { useStore } from '../state/store';

const TIMEOUTS = [1, 2, 5, 10, 15, 30];

const Settings: React.FC = () => {
  const { settings, updateSettings, changePin, lock, wipeAllData } = useStore();
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
        <div className="kv-row"><span className="k">Storage</span><span className="v">IndexedDB (on this device)</span></div>
        <div className="kv-row"><span className="k">Encryption</span><span className="v">AES-GCM / PBKDF2-SHA256</span></div>
        <div className="kv-row"><span className="k">Network use</span><span className="v">None — fully offline</span></div>
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

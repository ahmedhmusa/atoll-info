import React, { useEffect, useState } from 'react';
import { ScanFace } from 'lucide-react';
import { useStore } from '../state/store';
import { biometricAvailable } from '../lib/biometric';

/** Settings card to turn Face ID unlock on or off. */
const FaceIdCard: React.FC = () => {
  const { hasBiometric, enableBiometric, disableBiometric } = useStore();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<null | (() => Promise<{ ok: boolean; message: string }>)>(null);

  useEffect(() => { biometricAvailable().then(setAvailable); }, []);

  const turnOn = async () => {
    setBusy(true); setMsg(null);
    const r = await enableBiometric(pin);
    setBusy(false);
    setMsg(r.ok ? null : r.message);
    if (r.ok) setPin('');
    setPending(r.pending ? () => r.pending! : null);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    const r = await pending();
    setBusy(false);
    setMsg(r.ok ? null : r.message);
    if (r.ok) { setPin(''); setPending(null); }
  };

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ScanFace size={15} /> Face ID</div>
      {available === false && <div className="section-sub" style={{ marginBottom: 0 }}>Face ID isn't available here. Open the app from your Home Screen on an iPhone with Face ID turned on.</div>}
      {available && hasBiometric && (
        <>
          <div className="section-sub">Face ID unlock is on. Your PIN still works as a backup.</div>
          <button className="btn btn-danger" onClick={async () => { await disableBiometric(); setMsg('Face ID unlock is off.'); }}>Turn Off Face ID</button>
        </>
      )}
      {available && !hasBiometric && (
        <>
          <div className="section-sub">Unlock with your face instead of typing your PIN. Enter your PIN once to turn it on.</div>
          {!pending ? (
            <>
              <div className="field"><label>Current PIN</label><input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} /></div>
              <button className="btn btn-primary" onClick={turnOn} disabled={busy || pin.length < 6}>{busy ? 'Waiting for Face ID…' : 'Turn On Face ID'}</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Waiting for Face ID…' : 'Confirm with Face ID'}</button>
          )}
        </>
      )}
      {msg && <div className="section-sub" style={{ marginTop: 10, marginBottom: 0 }}>{msg}</div>}
    </div>
  );
};

export default FaceIdCard;

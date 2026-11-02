import React, { useEffect, useState } from 'react';
import { Shield, Lock, ScanFace } from 'lucide-react';
import { useStore } from '../state/store';

const MIN_PIN_LENGTH = 6;
// Automatic Face ID only on app launch, not right after pressing Lock.
let autoFaceIdTried = false;

export const LockScreen: React.FC = () => {
  const { hasPin, hasBiometric, setupPin, unlock, unlockWithBiometric, unlocking, error } = useStore();

  // Offer Face ID straight away when the app opens, like a native app.
  // If iOS needs a tap first, the button below does the same thing.
  useEffect(() => {
    if (hasPin && hasBiometric && !autoFaceIdTried) {
      autoFaceIdTried = true;
      unlockWithBiometric();
    }
  }, [hasPin, hasBiometric, unlockWithBiometric]);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (stage === 'enter') {
      if (pin.length < MIN_PIN_LENGTH) { setLocalError(`PIN must be at least ${MIN_PIN_LENGTH} characters.`); return; }
      setFirstPin(pin); setPin(''); setStage('confirm');
      return;
    }
    if (confirmPin !== firstPin) {
      setLocalError('PINs do not match. Try again.');
      setStage('enter'); setPin(''); setConfirmPin(''); setFirstPin('');
      return;
    }
    await setupPin(firstPin);
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const ok = await unlock(pin);
    if (!ok) setPin('');
  };

  if (!hasPin) {
    return (
      <div className="lock-screen">
        <div className="lock-badge"><Shield size={30} strokeWidth={1.75} /></div>
        <div className="lock-title">Set Up Your PIN</div>
        <div className="lock-sub">
          One-time setup. Choose a PIN (min. {MIN_PIN_LENGTH} characters). It encrypts everything on this device and
          is never sent anywhere. If you forget it, data can't be recovered.
        </div>
        <form onSubmit={handleSetupSubmit} style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          <input
            className="pin-input" type="password" inputMode="numeric" autoFocus
            placeholder={stage === 'enter' ? 'New PIN' : 'Confirm PIN'}
            value={stage === 'enter' ? pin : confirmPin}
            onChange={(e) => (stage === 'enter' ? setPin(e.target.value) : setConfirmPin(e.target.value))}
          />
          <div className="lock-error">{localError}</div>
          <button className="btn btn-primary" type="submit">{stage === 'enter' ? 'Continue' : 'Create & Unlock'}</button>
        </form>
        <div className="warning-box" style={{ maxWidth: 320 }}>
          FOR AUTHORIZED OFFICIAL USE ONLY.
        </div>
      </div>
    );
  }

  return (
    <div className="lock-screen">
      <div className="lock-badge"><Lock size={28} strokeWidth={1.75} /></div>
      <div className="lock-title">Atoll Info Locked</div>
      <div className="lock-sub">{hasBiometric ? 'Use Face ID or enter your PIN.' : 'Enter your PIN to unlock.'}</div>
      {hasBiometric && (
        <button type="button" className="faceid-btn" onClick={() => unlockWithBiometric()} disabled={unlocking} aria-label="Unlock with Face ID">
          <ScanFace size={44} strokeWidth={1.5} />
          <span>Unlock with Face ID</span>
        </button>
      )}
      <form onSubmit={handleUnlockSubmit} style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <input className="pin-input" type="password" inputMode="numeric" autoFocus={!hasBiometric} placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        <div className="lock-error">{error ?? localError}</div>
        <button className="btn btn-primary" type="submit" disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock'}</button>
      </form>
    </div>
  );
};

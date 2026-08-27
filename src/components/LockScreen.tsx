import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import { useStore } from '../state/store';

const MIN_PIN_LENGTH = 6;

export const LockScreen: React.FC = () => {
  const { hasPin, setupPin, unlock, unlocking, error } = useStore();
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
      <div className="lock-sub">Enter your PIN to unlock.</div>
      <form onSubmit={handleUnlockSubmit} style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <input className="pin-input" type="password" inputMode="numeric" autoFocus placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        <div className="lock-error">{error ?? localError}</div>
        <button className="btn btn-primary" type="submit" disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock'}</button>
      </form>
    </div>
  );
};

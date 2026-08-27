import React, { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { fileToResizedDataUrl } from '../lib/util';
import Avatar from './Avatar';

const PhotoField: React.FC<{ value?: string; onChange: (dataUrl: string | undefined) => void }> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChange(dataUrl);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="field">
      <label>Photo</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={value} size={56} />
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={() => inputRef.current?.click()} disabled={busy}>
            <Camera size={15} /> {busy ? 'Processing…' : value ? 'Replace' : 'Add Photo'}
          </button>
          {value && (
            <button type="button" className="icon-btn" onClick={() => onChange(undefined)} aria-label="Remove photo">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
      <div className="field-hint">Stored encrypted on this device only, resized to save space.</div>
    </div>
  );
};

export default PhotoField;

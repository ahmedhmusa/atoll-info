import React, { useRef, useState } from 'react';
import { Camera, Images, X, Expand } from 'lucide-react';
import { fileToResizedDataUrl } from '../lib/util';
import Avatar from './Avatar';
import PhotoLightbox from './PhotoLightbox';

interface Props {
  label: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  maxDim?: number;
}

const PhotoField: React.FC<Props> = ({ label, value, onChange, maxDim = 640 }) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToResizedDataUrl(file, maxDim));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => value && setViewing(true)}
          style={{ padding: 0, border: 'none', background: 'none', cursor: value ? 'zoom-in' : 'default' }}
          aria-label={value ? 'View full photo' : undefined}
        >
          <div style={{ position: 'relative' }}>
            <Avatar src={value} size={56} />
            {value && (
              <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Expand size={10} style={{ color: 'var(--text-dim)' }} />
              </div>
            )}
          </div>
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera size={15} /> Camera
          </button>
          <button type="button" className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => galleryRef.current?.click()} disabled={busy}>
            <Images size={15} /> Gallery
          </button>
          {value && (
            <button type="button" className="icon-btn" onClick={() => onChange(undefined)} aria-label="Remove photo">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {/* Two separate inputs: `capture` opens the camera directly, while the
          plain input (no `capture`) opens the normal photo library/gallery
          picker — some mobile browsers skip the gallery option entirely
          when `capture` is present, so these are kept distinct. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
      <div className="field-hint">{busy ? 'Processing…' : 'Stored encrypted on this device only, resized to save space.'}</div>
      {viewing && value && <PhotoLightbox src={value} title={label} onClose={() => setViewing(false)} />}
    </div>
  );
};

export default PhotoField;

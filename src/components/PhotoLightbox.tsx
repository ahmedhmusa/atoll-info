import React from 'react';
import { X } from 'lucide-react';

const PhotoLightbox: React.FC<{ src: string; title?: string; onClose: () => void }> = ({ src, title, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
  >
    <button
      onClick={onClose}
      aria-label="Close"
      style={{
        position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16,
        width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <X size={18} />
    </button>
    {title && <div style={{ color: '#fff', fontSize: 13, marginBottom: 12, opacity: 0.8 }}>{title}</div>}
    <img
      src={src}
      alt=""
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain' }}
    />
  </div>
);

export default PhotoLightbox;

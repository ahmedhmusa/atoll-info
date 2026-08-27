import React from 'react';
import { User } from 'lucide-react';

const Avatar: React.FC<{ src?: string; size?: number }> = ({ src, size = 40 }) => {
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    background: 'var(--card2)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  if (src) {
    return (
      <div style={style}>
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div style={style}>
      <User size={size * 0.5} style={{ color: 'var(--text-faint)' }} />
    </div>
  );
};

export default Avatar;

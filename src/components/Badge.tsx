import React from 'react';

const Badge: React.FC<{ text: string; kind?: 'neutral' | 'accent' | 'danger' | 'ok' }> = ({ text, kind = 'neutral' }) => (
  <span className={`badge badge-${kind}`}>{text}</span>
);

export default Badge;

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * iOS-style floating sheet. Rendered via a portal straight into <body> so it
 * always sits above the tab bar (iOS scroll containers create their own
 * stacking layer). Can be dismissed by swiping down on the handle/header.
 */
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheetRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    sheetRef.current.style.transition = 'none';
    sheetRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onUp = () => {
    if (!drag.current || !sheetRef.current) return;
    const { dy } = drag.current;
    drag.current = null;
    sheetRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
    if (dy > 110) {
      sheetRef.current.style.transform = 'translateY(110%)';
      setTimeout(onClose, 220);
    } else {
      sheetRef.current.style.transform = '';
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: 'none' }} className="modal-header-wrap">
          <div className="modal-handle"><span /></div>
          <div className="modal-header">
            <span />
            <div className="modal-title">{title}</div>
            <button className="glass-btn round" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2.5} /></button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;

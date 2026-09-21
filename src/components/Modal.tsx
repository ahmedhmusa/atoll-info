import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Rendered via a portal straight into <body>, outside the app's scrolling
 * content area. On iOS, a scroll container creates its own stacking layer,
 * which trapped the sheet underneath the bottom menu no matter its
 * z-index — rendering at the top level guarantees it sits above everything.
 */
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) =>
  createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle"><span /></div>
        <div className="modal-header">
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <button className="icon-btn" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );

export default Modal;

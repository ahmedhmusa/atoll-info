import React from 'react';
import { X } from 'lucide-react';

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="modal-handle"><span /></div>
      <div className="modal-header">
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        <button className="icon-btn" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

export default Modal;

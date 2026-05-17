import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
}) => (
  <motion.div
    className="projects-modal-overlay"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <motion.div
      className="projects-modal"
      style={{ maxWidth: 420 }}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      onClick={e => e.stopPropagation()}
    >
      {danger && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <AlertTriangle size={36} color="#EF4444" />
        </div>
      )}
      <h2 className="projects-modal-title">{title}</h2>
      <p className="projects-modal-sub">{message}</p>
      <div className="projects-modal-actions" style={{ marginTop: 20 }}>
        {onConfirm ? (
          <>
            <button className="projects-btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className={danger ? 'projects-btn-danger' : 'projects-btn-primary'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </>
        ) : (
          <button className="projects-btn-primary" style={{ marginLeft: 'auto' }} onClick={onClose}>OK</button>
        )}
      </div>
    </motion.div>
  </motion.div>
);

export default ConfirmModal;

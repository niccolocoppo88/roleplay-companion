import React, { useState } from 'react';

export default function ConfirmDialog({ title, message, confirmLabel = 'Elimina', onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-text-secondary text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn btn-danger flex-1 disabled:opacity-50"
          >
            {loading ? 'Eliminazione...' : confirmLabel}
          </button>
          <button onClick={onCancel} disabled={loading} className="btn btn-secondary flex-1">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
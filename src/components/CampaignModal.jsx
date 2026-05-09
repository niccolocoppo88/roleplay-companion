import React, { useState, useEffect } from 'react';

export default function CampaignModal({ mode = 'create', initial = null, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card border-border-primary max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {mode === 'create' ? 'Nuova Campagna' : 'Modifica Campagna'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-2">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome della campagna"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-2">Descrizione</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrizione opzionale..."
              rows={3}
              className="input resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Annulla</button>
            <button type="submit" disabled={!name.trim()} className="btn btn-primary">
              {mode === 'create' ? 'Crea' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
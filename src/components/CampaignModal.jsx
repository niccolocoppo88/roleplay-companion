import React, { useState } from 'react';

export default function CampaignModal({ mode = 'create', initial = {}, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const title = mode === 'edit' ? 'Modifica Campagna' : 'Nuova Campagna';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Il nome è obbligatorio');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description: description.trim() });
    } catch (err) {
      setError(err.message || 'Errore durante il salvataggio');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
              placeholder="Nome della campagna"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Descrizione
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Descrizione della campagna (opzionale)"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : mode === 'edit' ? 'Salva modifiche' : 'Crea Campagna'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
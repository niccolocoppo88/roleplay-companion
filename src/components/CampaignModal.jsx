import React, { useState, useEffect } from 'react';
import { playSound } from './session/ActiveSession';

// Default templates bundled with the app
const DEFAULT_TEMPLATES = [
  {
    id: 'default-fantasy',
    name: 'Avventura Fantasy Classica',
    description: 'Una campagna fantasy tradizionale con draghi, dungeon e eroi',
    category: 'Fantasy',
    content: JSON.stringify({ name: '', description: '', defaultCharacters: 3 }),
  },
  {
    id: 'default-gothic',
    name: 'Horror Gotico',
    description: 'Atmosfera cupa, creature oscure, segreti da scoprire',
    category: 'Horror',
    content: JSON.stringify({ name: '', description: '', defaultCharacters: 4 }),
  },
  {
    id: 'default-scifi',
    name: 'Avventura Sci-Fi',
    description: 'Esplorazione spaziale, alieni e tecnologia avanzata',
    category: 'Sci-Fi',
    content: JSON.stringify({ name: '', description: '', defaultCharacters: 5 }),
  },
  {
    id: 'default-mystery',
    name: 'Giallo/Mistero',
    description: 'Indagini, colpi di scena e risolvere enigmi',
    category: 'Mystery',
    content: JSON.stringify({ name: '', description: '', defaultCharacters: 4 }),
  },
  {
    id: 'default-wildwest',
    name: 'Faro West',
    description: 'Avventure nel selvaggio west con pistoleri e pionieri',
    category: 'Western',
    content: JSON.stringify({ name: '', description: '', defaultCharacters: 6 }),
  },
];

export default function CampaignModal({ mode = 'create', initial = null, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [showTemplates, setShowTemplates] = useState(mode === 'create');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Load custom templates from DB
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await window.db.templates.list();
        if (res.ok) setTemplates(res.data);
      } catch { /* ignore */ }
    }
    loadTemplates();
  }, []);

  const allTemplates = [...DEFAULT_TEMPLATES, ...templates];

  const handleSelectTemplate = (template) => {
    try {
      const content = typeof template.content === 'string' 
        ? JSON.parse(template.content) 
        : template.content;
      setName(content.name || '');
      setDescription(content.description || '');
    } catch { /* use defaults */ }
    setShowTemplates(false);
    playSound('notify');
  };

  const handleSaveAsTemplate = async () => {
    const templateName = prompt('Nome per questo template:');
    if (!templateName?.trim()) return;
    
    try {
      await window.db.templates.create({
        name: templateName.trim(),
        description: `Template salvato da: ${name}`,
        content: JSON.stringify({ name, description }),
        category: 'Custom',
      });
      playSound('success');
    } catch { /* ignore */ }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    playSound('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card border-border-primary max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto modal-content">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {mode === 'create' ? 'Nuova Campagna' : 'Modifica Campagna'}
        </h3>

        {showTemplates && mode === 'create' ? (
          // Template Gallery
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-text-secondary">Scegli un template</h4>
              <button 
                onClick={() => setShowTemplates(false)}
                className="text-xs text-accent-primary hover:underline"
              >
                Inizia da zero
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
              {allTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className="text-left p-3 rounded-lg border border-border-primary hover:border-accent-primary hover:bg-bg-tertiary transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">
                      {t.category === 'Fantasy' ? '🏰' : 
                       t.category === 'Horror' ? '👻' : 
                       t.category === 'Sci-Fi' ? '🚀' : 
                       t.category === 'Mystery' ? '🔍' : 
                       t.category === 'Western' ? '🤠' : '📜'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">{t.name}</p>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{t.description}</p>
                      <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                        {t.category}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Normal Form
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

            {mode === 'edit' && initial && (
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="text-sm text-accent-primary hover:underline flex items-center gap-1"
              >
                💾 Salva come template
              </button>
            )}

            <div className="flex justify-end gap-3 pt-2">
              {mode === 'create' && (
                <button 
                  type="button" 
                  onClick={() => setShowTemplates(true)} 
                  className="btn btn-secondary"
                >
                  📋 Template
                </button>
              )}
              <button type="button" onClick={onClose} className="btn btn-secondary">Annulla</button>
              <button type="submit" disabled={!name.trim()} className="btn btn-primary">
                {mode === 'create' ? 'Crea' : 'Salva'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
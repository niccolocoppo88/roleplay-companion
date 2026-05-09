import React, { useState } from 'react';

const CATEGORY_COLORS = {
  session: 'border-accent-primary text-accent-primary',
  dm: 'border-accent-warning text-accent-warning',
  loot: 'border-accent-success text-accent-success',
  other: 'border-text-muted text-text-muted',
};

const CATEGORY_LABELS = {
  session: 'Sessione',
  dm: 'DM',
  loot: 'Bottino',
  other: 'Altro',
};

export default function NotesTab({ notes }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? notes : notes.filter(n => n.category === filter);

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {['all', 'session', 'dm', 'loot', 'other'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filter === cat
                  ? 'bg-accent-primary text-bg-primary border-accent-primary'
                  : 'border-border-primary text-text-muted hover:border-border-hover'
              }`}
            >
              {cat === 'all' ? 'Tutte' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <button className="btn btn-primary text-sm">
          + Nuova Nota
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-4">
        {filtered.map(note => (
          <div key={note.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border uppercase tracking-wide ${CATEGORY_COLORS[note.category] || CATEGORY_COLORS.other}`}>
                  {CATEGORY_LABELS[note.category] || 'Altro'}
                </span>
                <span className="text-xs text-text-muted">{note.date}</span>
              </div>
              <div className="flex gap-2">
                <button className="text-text-muted hover:text-accent-primary text-sm">Modifica</button>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{note.content}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            Nessuna nota in questa categoria
          </div>
        )}
      </div>
    </div>
  );
}
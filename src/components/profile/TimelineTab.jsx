import React, { useState } from 'react';

const CATEGORY_CONFIG = {
  birth:     { icon: '🌱', label: 'Nascita',      color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
  milestone: { icon: '⚔️', label: 'Tappa',        color: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
  death:     { icon: '💀', label: 'Morte',         color: 'bg-rose-500/20 border-rose-500/40 text-rose-400' },
  session:   { icon: '🎲', label: 'Sessione',      color: 'bg-violet-500/20 border-violet-500/40 text-violet-400' },
  secret:    { icon: '🔮', label: 'Segreto',       color: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-400' },
};

const IMPORTANCE_CONFIG = {
  critical: { bar: 'bg-rose-500', label: 'Critico' },
  major:    { bar: 'bg-amber-500', label: 'Maggiore' },
  medium:   { bar: 'bg-blue-500', label: 'Medio' },
  minor:    { bar: 'bg-slate-500', label: 'Minore' },
};

export default function TimelineTab({ timeline = [] }) {
  const [expanded, setExpanded] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const filtered = timeline.filter(
    e => filterCategory === 'all' || e.category === filterCategory
  );

  // Sort chronologically
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

  const toggleExpand = (id) => setExpanded(prev => (prev === id ? null : id));

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Cronologia del Personaggio</h2>
          <p className="text-sm text-text-muted mt-0.5">
            {timeline.length} eventi — clicca per espandere
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {[['all', 'Tutti'], ...Object.entries(CATEGORY_CONFIG)].map(([cat, label]) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium border transition-colors
                ${filterCategory === cat
                  ? 'bg-accent-primary/20 border-accent-primary/60 text-accent-primary'
                  : 'bg-bg-tertiary border-border-primary text-text-muted hover:text-text-secondary hover:border-border-hover'
                }
              `}
            >
              {cat === 'all' ? label : `${CATEGORY_CONFIG[cat].icon} ${label}`}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <span className="text-3xl mb-3">📜</span>
          <p className="text-text-muted text-sm">Nessun evento in questa categoria</p>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[1.125rem] top-3 bottom-3 w-0.5 bg-border-primary" />

        <div className="space-y-3">
          {sorted.map((event) => {
            const cfg = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.milestone;
            const imp = IMPORTANCE_CONFIG[event.importance] || IMPORTANCE_CONFIG.medium;
            const isOpen = expanded === event.id;

            return (
              <div
                key={event.id}
                className={`
                  relative pl-10 rounded-lg border transition-all cursor-pointer
                  hover:border-border-hover
                  ${isOpen ? 'bg-bg-secondary border-border-secondary' : 'bg-bg-tertiary/50 border-transparent'}
                `}
                onClick={() => toggleExpand(event.id)}
              >
                {/* Icon bubble */}
                <div className={`
                  absolute left-2 top-3 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm
                  ${cfg.color}
                `}>
                  {cfg.icon}
                </div>

                {/* Importance bar on left */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${imp.bar}`}
                     style={{ opacity: isOpen ? 1 : 0.6 }} />

                <div className="px-4 py-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-text-muted">{event.date}</span>
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full border font-medium
                          ${cfg.color}
                        `}>
                          {cfg.label}
                        </span>
                        <span className={`
                          text-xs px-1.5 py-0.5 rounded border
                          ${imp.bar.replace('bg-', 'border-')} text-text-muted
                        `}>
                          {imp.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary mt-1 leading-snug">
                        {event.title}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">{event.era}</p>
                    </div>

                    {/* Expand chevron */}
                    <span className={`text-text-muted text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border-primary">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
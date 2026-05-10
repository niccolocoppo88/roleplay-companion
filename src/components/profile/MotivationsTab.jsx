import React, { useState } from 'react';

const MOTIVATION_ICONS = {
  primary: '🎯',
  secondary: '🔥',
  unconscious: '👁️',
};

const MOTIVATION_LABELS = {
  primary: 'Motivazione Primaria',
  secondary: 'Motivazione Secondaria',
  unconscious: 'Motivazione Inconscia',
};

const MOTIVATION_COLORS = {
  primary: 'text-accent-primary border-accent-primary',
  secondary: 'text-accent-warning border-accent-warning',
  unconscious: 'text-purple-400 border-purple-400',
};

const MOTIVATION_DESCRIPTIONS = {
  primary: 'La spinta principale che guida tutte le azioni del personaggio',
  secondary: 'La motivazione di supporto che rafforza il cammino',
  unconscious: 'Ciò che il personaggio non riconosce consciamente',
};

const PRIORITY_ORDER = ['primary', 'secondary', 'unconscious'];

export default function MotivationsTab({ motivations }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [sortByPriority, setSortByPriority] = useState(true);

  if (!motivations) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center text-text-muted">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-text-muted">Nessuna motivazione registrata per questo personaggio.</p>
          <p className="text-xs text-text-muted mt-2">Le motivazioni verranno generate automaticamente durante le sessioni</p>
        </div>
      </div>
    );
  }

  // Build sections array with priority sorting
  const sections = PRIORITY_ORDER
    .filter(key => motivations[key])
    .map(key => ({
      key,
      data: motivations[key],
      priority: PRIORITY_ORDER.indexOf(key),
    }));

  // If not sorting by priority, use original order
  const sortedSections = sortByPriority
    ? [...sections].sort((a, b) => a.priority - b.priority)
    : sections;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-text-secondary text-sm max-w-lg">
          Le motivazioni sono il motore segreto delle azioni. Alcune sono chiare, altre si nascondono nell'ombra della coscienza.
        </p>
        <button
          onClick={() => setSortByPriority(!sortByPriority)}
          className={`
            px-3 py-1.5 text-xs rounded-full border flex items-center gap-2 transition-colors
            ${sortByPriority 
              ? 'bg-accent-primary/20 border-accent-primary/60 text-accent-primary' 
              : 'border-border-primary text-text-muted hover:border-border-hover'
            }
          `}
          title={sortByPriority ? 'Ordinate per priorità' : 'Ordine predefinito'}
        >
          <span>📊</span>
          <span>Priorità</span>
          <span className={`text-text-muted transition-transform ${sortByPriority ? 'rotate-180' : ''}`}>
            ↓
          </span>
        </button>
      </div>

      {/* Priority badges */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs text-text-muted">Priority:</span>
        {PRIORITY_ORDER.map((key, idx) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
              key === 'primary' ? 'border-accent-primary text-accent-primary' :
              key === 'secondary' ? 'border-accent-warning text-accent-warning' :
              'border-purple-400 text-purple-400'
            }`}>
              {idx + 1}
            </span>
            <span className="text-xs text-text-muted">{MOTIVATION_LABELS[key]}</span>
          </div>
        ))}
      </div>

      {/* Motivation Sections - sorted by priority */}
      <div className="space-y-4">
        {sortedSections.map(({ key, data }) => {
          if (!data) return null;

          const isExpanded = expandedSection === key;
          const colorClass = MOTIVATION_COLORS[key];
          const borderColor = colorClass.split(' ')[1];
          const priorityNum = PRIORITY_ORDER.indexOf(key) + 1;

          return (
            <div
              key={key}
              className="card border-l-4"
              style={{ borderLeftColor: `var(--${borderColor.replace('accent-', '')})` }}
            >
              {/* Section Header */}
              <button
                onClick={() => setExpandedSection(isExpanded ? null : key)}
                className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Priority badge */}
                  <span className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold
                    ${key === 'primary' ? 'border-accent-primary text-accent-primary' :
                      key === 'secondary' ? 'border-accent-warning text-accent-warning' :
                      'border-purple-400 text-purple-400'}
                  `}>
                    {priorityNum}
                  </span>
                  
                  <span className="text-2xl">{MOTIVATION_ICONS[key]}</span>
                  <div className="text-left">
                    <h3 className={`font-semibold ${colorClass.split(' ')[0]}`}>
                      {MOTIVATION_LABELS[key]}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {MOTIVATION_DESCRIPTIONS[key]}
                    </p>
                  </div>
                </div>
                <span className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-border-primary pt-4">
                    <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
                      {data}
                    </p>
                  </div>
                  {key === 'unconscious' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                      <span>🔒</span>
                      <span>Motivazione inconscia - visibile solo a te</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Motivation Summary */}
      <div className="mt-6 card bg-bg-tertiary p-4">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">Riepilogo Motivazioni</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          {PRIORITY_ORDER.map((key, idx) => (
            <div key={key}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className={`
                  w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold
                  ${key === 'primary' ? 'border-accent-primary text-accent-primary' :
                    key === 'secondary' ? 'border-accent-warning text-accent-warning' :
                    'border-purple-400 text-purple-400'}
                `}>
                  {idx + 1}
                </span>
              </div>
              <div className="text-lg font-bold text-text-primary">
                {motivations[key] ? getWordCount(motivations[key]) : 0}
              </div>
              <div className="text-xs text-text-muted">
                {key === 'primary' ? 'Primaria' : key === 'secondary' ? 'Secondaria' : 'Inconscia'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getWordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
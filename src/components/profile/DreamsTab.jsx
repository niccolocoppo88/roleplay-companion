import React, { useState } from 'react';

const DREAM_ICONS = {
  shortTerm: '🎯',
  longTerm: '🚀',
  hidden: '🔮',
};

const DREAM_LABELS = {
  shortTerm: 'Sogni a Breve Termine',
  longTerm: 'Sogni a Lungo Termine',
  hidden: 'Sogni Nascosti',
};

const DREAM_COLORS = {
  shortTerm: 'text-accent-success border-accent-success',
  longTerm: 'text-accent-primary border-accent-primary',
  hidden: 'text-purple-400 border-purple-400',
};

export default function DreamsTab({ dreams }) {
  const [expandedSection, setExpandedSection] = useState(null);

  if (!dreams) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center text-text-muted">
          Nessun sogno registrato per questo personaggio.
        </div>
      </div>
    );
  }

  const sections = [
    { key: 'shortTerm', data: dreams.shortTerm },
    { key: 'longTerm', data: dreams.longTerm },
    { key: 'hidden', data: dreams.hidden },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-text-secondary text-sm">
          I sogni e le speranze guidano le azioni di un personaggio. Alcuni sono condivisi, altri custoditi nel cuore.
        </p>
      </div>

      {/* Dream Sections */}
      <div className="space-y-4">
        {sections.map(({ key, data }) => {
          if (!data) return null;
          
          const isExpanded = expandedSection === key;
          const colorClass = DREAM_COLORS[key];
          
          return (
            <div
              key={key}
              className="card border-l-4 border-l-2"
              style={{ borderLeftColor: colorClass.split(' ')[1].replace('text-', '') }}
            >
              {/* Section Header */}
              <button
                onClick={() => setExpandedSection(isExpanded ? null : key)}
                className="w-full flex items-center justify-between p-4 hover:bg-bg-tertiary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{DREAM_ICONS[key]}</span>
                  <div className="text-left">
                    <h3 className={`font-semibold ${colorClass.split(' ')[0]}`}>
                      {DREAM_LABELS[key]}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {getWordCount(data)} parole
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
                  {key === 'hidden' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                      <span>🔒</span>
                      <span>Sogno nascosto - visibile solo a te</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dream Stats */}
      <div className="mt-6 card bg-bg-tertiary p-4">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">Riepilogo Sogni</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          {sections.map(({ key, data }) => (
            <div key={key}>
              <div className="text-lg font-bold text-text-primary">
                {data ? getWordCount(data) : 0}
              </div>
              <div className="text-xs text-text-muted">
                {key === 'shortTerm' ? 'Breve termine' : key === 'longTerm' ? 'Lungo termine' : 'Nascosti'}
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
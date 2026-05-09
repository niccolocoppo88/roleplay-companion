import React, { useState } from 'react';

const FEAR_ICONS = {
  surface: '😰',
  deep: '👁️',
  whatTheyAvoid: '🚫',
};

const FEAR_LABELS = {
  surface: 'Paure Superficiali',
  deep: 'Paure Nascoste',
  whatTheyAvoid: 'Ciò che Evita',
};

const FEAR_COLORS = {
  surface: 'text-accent-warning border-accent-warning',
  deep: 'text-purple-400 border-purple-400',
  whatTheyAvoid: 'text-accent-danger border-accent-danger',
};

const AVOIDANCE_ICONS = {
  behaviors: '🔄',
  places: '📍',
  people: '👥',
};

export default function FearsTab({ fears }) {
  const [expandedSection, setExpandedSection] = useState('surface');

  if (!fears) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center text-text-muted">
          Nessuna paura registrata per questo personaggio.
        </div>
      </div>
    );
  }

  const sections = [
    { key: 'surface', data: fears.surface, description: 'Ciò che il personaggio ammette apertamente' },
    { key: 'deep', data: fears.deep, description: 'Paure che custodisce nel profondo' },
    { key: 'whatTheyAvoid', data: fears.whatTheyAvoid, description: 'Comportamenti, luoghi e persone che evita' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-text-secondary text-sm">
          Le paure plasmano le reazioni di un personaggio. Alcune sono evidenti, altre si nascondono sotto la superficie.
        </p>
      </div>

      {/* Fear Sections */}
      <div className="space-y-4">
        {sections.map(({ key, data, description }) => {
          if (!data) return null;

          const isExpanded = expandedSection === key;
          const colorClass = FEAR_COLORS[key];
          const borderColor = colorClass.split(' ')[1];

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
                  <span className="text-2xl">{FEAR_ICONS[key]}</span>
                  <div className="text-left">
                    <h3 className={`font-semibold ${colorClass.split(' ')[0]}`}>
                      {FEAR_LABELS[key]}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      {description}
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
                    {key === 'whatTheyAvoid' ? (
                      <AvoidanceContent content={data} />
                    ) : (
                      <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
                        {data}
                      </p>
                    )}
                  </div>
                  {key === 'deep' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                      <span>🔒</span>
                      <span>Paura nascosta - visibile solo a te</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fear Summary */}
      <div className="mt-6 card bg-bg-tertiary p-4">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">Riepilogo Paure</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          {sections.map(({ key, data }) => (
            <div key={key}>
              <div className="text-lg font-bold text-text-primary">
                {data ? getWordCount(data) : 0}
              </div>
              <div className="text-xs text-text-muted">
                {FEAR_LABELS[key]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvoidanceContent({ content }) {
  const [activeAvoidance, setActiveAvoidance] = useState(null);

  // Parse content into categories if it contains markers
  // Otherwise display as a single block
  const hasCategories = content.includes('**');

  if (!hasCategories) {
    return <p className="text-text-primary leading-relaxed">{content}</p>;
  }

  // Split content into sections
  const sections = parseAvoidanceContent(content);

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={index} className="bg-bg-tertiary rounded-lg p-3">
          <button
            onClick={() => setActiveAvoidance(activeAvoidance === index ? null : index)}
            className="w-full flex items-center gap-2 text-left"
          >
            <span className="text-lg">{getAvoidanceIcon(section.type)}</span>
            <span className="text-sm font-medium text-text-primary">{section.type}</span>
            <span className={`ml-auto text-text-muted text-xs transition-transform ${activeAvoidance === index ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {activeAvoidance === index && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed pl-7">
              {section.items}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function parseAvoidanceContent(content) {
  const sections = [];
  const regex = /\*\*(.*?)\*\*:\s*([\s\S]*?)(?=\*\*|$)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    sections.push({
      type: match[1].trim(),
      items: match[2].trim(),
    });
  }

  return sections;
}

function getAvoidanceIcon(type) {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('comportament') || lowerType.includes('behavior')) {
    return AVOIDANCE_ICONS.behaviors;
  }
  if (lowerType.includes('luog') || lowerType.includes('place')) {
    return AVOIDANCE_ICONS.places;
  }
  if (lowerType.includes('person') || lowerType.includes('people')) {
    return AVOIDANCE_ICONS.people;
  }
  return '⚠️';
}

function getWordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
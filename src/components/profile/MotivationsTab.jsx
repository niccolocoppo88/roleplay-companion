import React, { useState } from 'react';

const PRIORITY_COLORS = {
  critical: 'border-accent-danger text-accent-danger',
  high: 'border-accent-warning text-accent-warning',
  medium: 'border-accent-primary text-accent-primary',
  low: 'border-text-muted text-text-muted',
};

const STATUS_BADGES = {
  active: 'bg-accent-success/20 text-accent-success border border-accent-success/30',
  pending: 'bg-text-muted/20 text-text-muted border border-text-muted/30',
  completed: 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30',
};

const URGENCY_COLORS = {
  critical: 'bg-accent-danger/10 border-l-2 border-l-accent-danger',
  high: 'bg-accent-warning/10 border-l-2 border-l-accent-warning',
  medium: 'bg-accent-primary/10 border-l-2 border-l-accent-primary',
};

export default function MotivationsTab({ motivations }) {
  const [activeSection, setActiveSection] = useState('core');

  const sections = [
    { id: 'core', label: 'Cuore', icon: '🔥' },
    { id: 'shortTerm', label: 'Obiettivi Breve Termine', icon: '🎯' },
    { id: 'longTerm', label: 'Obiettivi Lungo Termine', icon: '🏔️' },
    { id: 'values', label: 'Valori Dirimpettai', icon: '⚖️' },
    { id: 'pressure', label: 'Pressioni Esterne', icon: '⏰' },
  ];

  return (
    <div className="p-6">
      {/* Section Navigation */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${activeSection === section.id
                ? 'bg-accent-primary text-bg-primary'
                : 'bg-bg-tertiary text-text-muted hover:text-text-secondary hover:bg-bg-secondary border border-border-primary'
              }
            `}
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Core Motivation — Hero Section */}
      {activeSection === 'core' && (
        <div className="max-w-2xl">
          <div className="card border-l-4 border-l-accent-danger">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔥</span>
              <h3 className="text-sm font-semibold text-accent-danger uppercase tracking-wide">Motivazione Centrale</h3>
            </div>
            <p className="text-lg text-text-primary leading-relaxed italic">
              "{motivations.coreMotivation}"
            </p>
          </div>

          {/* Quick Overview Cards */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="card text-center">
              <div className="text-3xl mb-2">🎯</div>
              <div className="text-2xl font-bold text-accent-primary">{motivations.shortTermGoals.filter(g => g.status === 'active').length}</div>
              <div className="text-xs text-text-muted uppercase tracking-wide">Obiettivi Attivi</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl mb-2">🏔️</div>
              <div className="text-2xl font-bold text-accent-warning">{motivations.longTermGoals.filter(g => g.status === 'pending').length}</div>
              <div className="text-xs text-text-muted uppercase tracking-wide">Missioni in Attesa</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl mb-2">⚖️</div>
              <div className="text-2xl font-bold text-accent-primary">{motivations.drivingValues.length}</div>
              <div className="text-xs text-text-muted uppercase tracking-wide">Valori Cardine</div>
            </div>
          </div>
        </div>
      )}

      {/* Short Term Goals */}
      {activeSection === 'shortTerm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
              Obiettivi a Breve Termine
            </h3>
            <span className="text-xs text-text-muted">
              {motivations.shortTermGoals.filter(g => g.status === 'active').length} attivi
            </span>
          </div>
          {motivations.shortTermGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {/* Long Term Goals */}
      {activeSection === 'longTerm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
              Missioni a Lungo Termine
            </h3>
            <span className="text-xs text-text-muted">
              {motivations.longTermGoals.filter(g => g.status === 'pending').length} in attesa
            </span>
          </div>
          {motivations.longTermGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {/* Driving Values */}
      {activeSection === 'values' && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
            Valori che Guidano le Scelte
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {motivations.drivingValues
              .sort((a, b) => b.weight - a.weight)
              .map(value => (
                <div key={value.id} className="card">
                  <div className="flex items-start gap-4">
                    {/* Weight indicator */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-2xl font-bold text-accent-warning">{value.weight}</div>
                      <div className="text-xs text-text-muted">peso</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-text-primary">{value.value}</h4>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed italic">
                        "{value.description}"
                      </p>
                    </div>
                    {/* Visual weight bar */}
                    <div className="w-24 self-center">
                      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-warning rounded-full transition-all duration-300"
                          style={{ width: `${(value.weight / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* External Pressures */}
      {activeSection === 'pressure' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
            Pressioni che Sfuggono al Controllo
          </h3>
          {motivations.externalPressures
            .sort((a, b) => {
              const order = { critical: 0, high: 1, medium: 2 };
              return order[a.urgency] - order[b.urgency];
            })
            .map(pressure => (
              <div
                key={pressure.id}
                className={`card ${URGENCY_COLORS[pressure.urgency] || ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-text-primary leading-relaxed">{pressure.pressure}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full uppercase tracking-wide font-medium ${
                    pressure.urgency === 'critical' ? 'bg-accent-danger/20 text-accent-danger' :
                    pressure.urgency === 'high' ? 'bg-accent-warning/20 text-accent-warning' :
                    'bg-accent-primary/20 text-accent-primary'
                  }`}>
                    {pressure.urgency}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`card cursor-pointer transition-all hover:border-border-hover ${expanded ? 'border-border-hover' : ''}`}>
      <div
        className="flex items-start gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <div className={`mt-0.5 w-3 h-3 rounded-full ${
          goal.status === 'active' ? 'bg-accent-success' :
          goal.status === 'completed' ? 'bg-accent-primary' : 'bg-text-muted'
        }`} />

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-sm text-text-primary font-medium">{goal.text}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wide ${
              PRIORITY_COLORS[goal.priority] || PRIORITY_COLORS.low
            }`}>
              {goal.priority}
            </span>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-border-primary">
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className={`px-2 py-1 rounded-full uppercase tracking-wide font-medium ${STATUS_BADGES[goal.status]}`}>
                  {goal.status}
                </span>
                <span>Priorità: {goal.priority}</span>
              </div>
            </div>
          )}
        </div>

        {/* Expand icon */}
        <span className={`text-text-muted text-sm transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
    </div>
  );
}
import React, { useState, useCallback } from 'react';

const SEVERITY_COLORS = {
  high: {
    border: 'border-accent-danger',
    bg: 'bg-accent-danger/10',
    text: 'text-accent-danger',
    icon: '🔴',
    label: 'Alta',
  },
  medium: {
    border: 'border-accent-warning',
    bg: 'bg-accent-warning/10',
    text: 'text-accent-warning',
    icon: '🟡',
    label: 'Media',
  },
  low: {
    border: 'border-accent-primary',
    bg: 'bg-accent-primary/10',
    text: 'text-accent-primary',
    icon: '🟢',
    label: 'Bassa',
  },
};

const RULE_LABELS = {
  fear_contradiction: 'Contraddizione Paura',
  backstory_conflict: 'Conflitto Backstory',
  catchphrase_overuse: 'Catchphrase Ripetuto',
  goal_alignment: 'Allineamento Obiettivi',
  motivation_contradiction: 'Contraddizione Motivazione',
};

export default function ConsistencyTab({ character, onCheckContent }) {
  const [content, setContent] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!content.trim() || !character) return;
    setLoading(true);
    try {
      const result = await window.consistency.check(character, content);
      if (result.ok) {
        setWarnings([]);
      } else {
        setWarnings(result.data?.warnings || []);
      }
      setHasChecked(true);
    } catch (err) {
      console.error('Consistency check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [content, character]);

  const handleClear = () => {
    setContent('');
    setWarnings([]);
    setHasChecked(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          🔍 Consistency Checker
        </h2>
        <p className="text-sm text-text-secondary">
          Verifica se un contenuto contraddice il profilo del personaggio.
          Incolla il testo da verificare (dialogo, diario, canzone...) e premi "Controlla".
        </p>
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Incolla qui il contenuto da verificare per "${character?.name || 'il PG'}"...\n\nEsempio: Thorin entrò nella stanza buia senza esitazione alcuna. Il fuoco ardeva tutto intorno ma lui non provò paura.`}
          className="w-full h-40 p-4 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-primary transition-colors"
        />
        <div className="flex gap-3">
          <button
            onClick={handleCheck}
            disabled={!content.trim() || loading}
            className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Controllando...' : '🔍 Controlla Consistenza'}
          </button>
          {hasChecked && (
            <button
              onClick={handleClear}
              className="btn btn-secondary text-sm"
            >
              🗑️ Pulisci
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {hasChecked && (
        <div className="space-y-4">
          {warnings.length === 0 ? (
            <div className="card border border-accent-success/30 bg-accent-success/5 p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-text-primary font-medium">
                Nessuna contraddizione trovata
              </p>
              <p className="text-sm text-text-muted mt-1">
                Il contenuto è coerente col profilo del personaggio.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span>⚠️</span>
                <span>{warnings.length} inconsistenza{warnings.length > 1 ? 'i' : ''} trovata{warnings.length > 1 ? 'e' : ''}</span>
              </div>
              {warnings.map((warning, index) => {
                const severity = SEVERITY_COLORS[warning.severity] || SEVERITY_COLORS.medium;
                return (
                  <div
                    key={index}
                    className={`card border-l-4 ${severity.border} ${severity.bg} p-4`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{severity.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${severity.bg} ${severity.text}`}>
                            {severity.label}
                          </span>
                          <span className="text-xs text-text-muted">
                            {RULE_LABELS[warning.rule] || warning.rule}
                          </span>
                        </div>
                        <p className="text-sm text-text-primary leading-relaxed">
                          {warning.message}
                        </p>
                        {warning.detail && (
                          <div className="mt-2 p-2 bg-bg-primary rounded border border-border-subtle">
                            <p className="text-xs text-text-muted mb-1">Estratto:</p>
                            <p className="text-xs text-text-secondary italic">
                              "{warning.detail}"
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-text-muted mt-2">
                          Campo: <code className="text-accent-primary">{warning.profile_field}</code>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Available rules reference */}
      <div className="card bg-bg-tertiary p-4">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">Regole verificate</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { name: 'fear_contradiction', desc: 'Il PG affronta senza paura qualcosa che dovrebbe temere', severity: 'high' },
            { name: 'backstory_conflict', desc: 'Il contenuto contraddice elementi del backstory', severity: 'high' },
            { name: 'catchphrase_overuse', desc: 'Catchphrase usato troppe volte (3+)', severity: 'low' },
            { name: 'goal_alignment', desc: 'Il PG abbandona obiettivi senza giustificazione', severity: 'medium' },
            { name: 'motivation_contradiction', desc: 'Azioni in contraddizione con le motivazioni', severity: 'medium' },
          ].map((rule) => {
            const sev = SEVERITY_COLORS[rule.severity];
            return (
              <div key={rule.name} className="flex items-start gap-2 text-xs">
                <span className={sev.text}>{sev.icon}</span>
                <div>
                  <code className="text-text-primary">{rule.name}</code>
                  <p className="text-text-muted">{rule.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
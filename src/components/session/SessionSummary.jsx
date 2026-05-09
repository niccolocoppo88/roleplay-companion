/**
 * src/components/session/SessionSummary.jsx
 *
 * Post-session summary UI — shown after a Meet session ends.
 * Displays all generated content (journal, songs, memories, etc.)
 * for the character that was active during the session.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const TYPE_ICONS = {
  journal:    '📔',
  song:       '🎵',
  poetry:     '🎼',
  memory:     '💭',
  catchphrase: '💬',
  item:       '⚔️',
  letter:     '📜',
  note:       '📝',
};

const TYPE_LABELS = {
  journal:    'Diario',
  song:       'Canzone',
  poetry:     'Poesia',
  memory:     'Memoria',
  catchphrase: 'Catchphrase',
  item:       'Oggetto Iconico',
  letter:     'Lettera',
  note:       'Nota',
};

function typeBadgeColor(type) {
  const colors = {
    journal:     'bg-accent-amber/20 text-accent-amber',
    song:        'bg-accent-purple/20 text-accent-purple',
    poetry:      'bg-accent-purple/20 text-accent-purple',
    memory:      'bg-accent-blue/20 text-accent-blue',
    catchphrase: 'bg-accent-success/20 text-accent-success',
    item:        'bg-accent-gold/20 text-accent-gold',
    letter:      'bg-text-muted/20 text-text-secondary',
    note:        'bg-text-muted/20 text-text-secondary',
  };
  return colors[type] ?? 'bg-bg-tertiary text-text-muted';
}

function ContentCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TYPE_ICONS[item.type] ?? '📄';
  const label = TYPE_LABELS[item.type] ?? item.type;
  const badgeClass = typeBadgeColor(item.type);

  return (
    <div className="card border border-border-subtle hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
            {label}
          </span>
        </div>
        <span className="text-text-muted text-xs">
          {new Date(item.generated_at).toLocaleDateString('it-IT', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
          })}
        </span>
      </div>

      {/* Context */}
      {item.context && (
        <p className="text-text-muted text-xs mb-2 italic">"{item.context}"</p>
      )}

      {/* Content preview */}
      <div className={`text-text-secondary text-sm leading-relaxed whitespace-pre-wrap ${!expanded ? 'line-clamp-3' : ''}`}>
        {item.content}
      </div>

      {item.content.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-accent-primary text-xs hover:underline"
        >
          {expanded ? '▲ riduci' : '▼ espandi'}
        </button>
      )}
    </div>
  );
}

function EmptyState({ type }) {
  const messages = {
    journal:    'Nessuna entry del diario ancora. La AI la generera dopo la prossima sessione.',
    song:       'Nessuna canzone ancora. Il personaggio la comporrà dopo la prossima avventura.',
    memory:     'Nessuna memoria ancora. I momenti significativi verranno salvati dopo la sessione.',
    catchphrase: 'Nessun catchphrase ancora. Le battute iconiche verranno estratte dopo la sessione.',
    item:       'Nessun oggetto iconico ancora. Gli oggetti memorabili verranno descritti dopo la sessione.',
    letter:     'Nessuna lettera ancora. Il personaggio scriverà dopo la prossima avventura.',
    note:       'Nessuna nota ancora.',
  };
  return (
    <div className="text-center py-8 text-text-muted text-sm">
      {messages[type] ?? 'Nessun contenuto generato.'}
    </div>
  );
}

export default function SessionSummary({ sessionId, campaignId, characterId, onDone }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeType, setActiveType] = useState('all');

  // Fetch generated content for this character
  useEffect(() => {
    async function load() {
      try {
        const res = await window.db.generated.list(characterId);
        if (res.ok) {
          setContents(res.data || []);
        } else {
          setError(res.error || 'Errore nel caricamento');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [characterId]);

  const filtered = activeType === 'all'
    ? contents
    : contents.filter(c => c.type === activeType);

  const groupedByType = contents.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || [];
    acc[item.type].push(item);
    return acc;
  }, {});

  const typeCounts = Object.entries(groupedByType).map(([type, items]) => ({
    type,
    count: items.length,
    icon: TYPE_ICONS[type] ?? '📄',
  }));

  const allTypes = ['all', ...Object.keys(groupedByType)];

  return (
    <div className="card border border-accent-amber/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-amber/20 border border-accent-amber/40 flex items-center justify-center text-xl">✨</div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Sessione Terminata!</h2>
            <p className="text-text-muted text-sm">Contenuti generati per questo personaggio</p>
          </div>
        </div>
        <button
          onClick={onDone}
          className="btn btn-secondary text-sm"
        >
          Chiudi
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-8 text-text-muted">Caricamento contenuti...</div>
      )}
      {error && (
        <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Stats bar */}
      {!loading && contents.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {typeCounts.map(({ type, count, icon }) => (
            <div
              key={type}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                activeType === type
                  ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary'
                  : 'bg-bg-tertiary border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
              onClick={() => setActiveType(activeType === type ? 'all' : type)}
            >
              <span>{icon}</span>
              <span>{TYPE_LABELS[type] ?? type}</span>
              <span className="ml-1 opacity-60">×{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map(item => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && contents.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🎭</div>
          <h3 className="text-text-primary font-semibold mb-2">Nessun contenuto generato</h3>
          <p className="text-text-muted text-sm max-w-sm mx-auto">
            I contenuti come diari, canzoni e memorie verranno generati automaticamente 
            dopo ogni sessione dal sistema AI.
          </p>
        </div>
      )}

      {/* Navigation */}
      {!loading && contents.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between">
          <p className="text-text-muted text-xs">
            Totale: {contents.length} contenuti generati
          </p>
          <Link
            to={`/campaigns/${campaignId}/characters/${characterId}`}
            className="text-accent-primary text-sm hover:underline"
          >
            Apri profilo personaggio →
          </Link>
        </div>
      )}
    </div>
  );
}
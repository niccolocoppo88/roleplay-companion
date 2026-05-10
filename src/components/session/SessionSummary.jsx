/**
 * src/components/session/SessionSummary.jsx
 *
 * Post-session summary UI — shown after a Meet session ends.
 * Displays all generated content (journal, songs, memories, etc.)
 * for the character that was active during the session.
 * 
 * Enhanced with:
 * - Session highlights generation
 * - Best moment selection
 * - Character growth suggestions
 * - Save to character profile functionality
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
  highlight:  '⭐',
  growth:     '📈',
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
  highlight:  'Momento Top',
  growth:     'Crescita',
};

function typeBadgeColor(type) {
  const colors = {
    journal:     'bg-yellow-600/20 text-yellow-600',
    song:        'bg-accent-purple/20 text-accent-purple',
    poetry:      'bg-accent-purple/20 text-accent-purple',
    memory:      'bg-accent-blue/20 text-accent-blue',
    catchphrase: 'bg-accent-success/20 text-accent-success',
    item:        'bg-accent-gold/20 text-accent-gold',
    letter:      'bg-text-muted/20 text-text-secondary',
    note:        'bg-text-muted/20 text-text-secondary',
    highlight:   'bg-accent-primary/20 text-accent-primary',
    growth:      'bg-accent-success/20 text-accent-success',
  };
  return colors[type] ?? 'bg-bg-tertiary text-text-muted';
}

function ContentCard({ item, onSaveToProfile }) {
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
        <div className="flex items-center gap-2">
          {onSaveToProfile && (
            <button
              onClick={() => onSaveToProfile(item)}
              className="text-text-muted hover:text-accent-primary text-xs px-2 py-1 rounded border border-border-subtle hover:border-accent-primary transition-colors"
              title="Salva nel profilo personaggio"
            >
              💾 Salva
            </button>
          )}
          <span className="text-text-muted text-xs">
            {new Date(item.generated_at).toLocaleDateString('it-IT', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>
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
    song:       'Nessuna canzone ancora. Il personaggio la comporra dopo la prossima avventura.',
    memory:     'Nessuna memoria ancora. I momenti significativi verranno salvati dopo la sessione.',
    catchphrase: 'Nessun catchphrase ancora. Le battute iconiche verranno estratte dopo la sessione.',
    item:       'Nessun oggetto iconico ancora. Gli oggetti memorabili verranno descritti dopo la sessione.',
    letter:     'Nessuna lettera ancora. Il personaggio scriverà dopo la prossima avventura.',
    note:       'Nessuna nota ancora.',
    highlight:  'Il momento migliore della sessione apparira qui.',
    growth:     'I suggerimenti di crescita del personaggio appariranno qui.',
  };
  return (
    <div className="text-center py-8 text-text-muted text-sm">
      {messages[type] ?? 'Nessun contenuto generato.'}
    </div>
  );
}

// ─── Session Summary Generator ──────────────────────────────────────────────

function SessionSummaryGenerator({ sessionId, characterId, character, onGenerated }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  async function generateSessionSummary() {
    setGenerating(true);
    setError('');
    try {
      const prompt = `Analizza la seguente sessione di gioco D&D e genera un riepilogo con i momenti salienti.

Personaggio: ${character?.name || 'Sconosciuto'}
Razza: ${character?.race || 'Sconosciuta'}
Classe: ${character?.class || 'Sconosciuta'}
Livello: ${character?.level || 1}
Background: ${character?.backstory || 'Non definito'}
Obiettivi: ${character?.motivations?.primary || 'Non definiti'}

Genera:
1. **Session Highlights**: 3-5 momenti salienti della sessione
2. **Best Moment**: Il momento più memorabile con descrizione dettagliata
3. **Character Growth**: Suggerimenti per la crescita del personaggio basati sulla sessione (nuovi tratti, evoluzione, lezioni imparate)

Rispondi SOLO con un JSON valido (nessun altro testo):
{
  "highlights": ["momento 1", "momento 2", "momento 3"],
  "bestMoment": {
    "title": "titolo del momento",
    "description": "descrizione dettagliata di cosa è successo"
  },
  "characterGrowth": {
    "newTrait": "nuovo tratto sviluppato dal personaggio",
    "lessonLearned": "lezione imparata durante la sessione",
    "futureDirection": "direzione futura per lo sviluppo del personaggio"
  }
}`;

      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=somegroupid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer SOME_API_KEY'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          tokens_to_generate: 800,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      const content = data.choices?.[0]?.messages?.[0]?.text || data.choices?.[0]?.content || '';
      
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      
      const parsed = JSON.parse(jsonStr);
      setSummary(parsed);
      
      // Also create generated content entries for each highlight
      if (parsed.highlights) {
        for (const highlight of parsed.highlights) {
          await window.db.generated.create({
            character_id: characterId,
            session_id: sessionId,
            type: 'highlight',
            content: highlight,
            generated_at: new Date().toISOString(),
          });
        }
      }
      
      if (parsed.characterGrowth) {
        await window.db.generated.create({
          character_id: characterId,
          session_id: sessionId,
          type: 'growth',
          content: JSON.stringify(parsed.characterGrowth),
          generated_at: new Date().toISOString(),
        });
      }
      
      onGenerated?.();
    } catch (err) {
      console.error('Session summary generation error:', err);
      setError(err.message || 'Errore nella generazione del riepilogo');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-bg-tertiary rounded-lg p-4 border border-border-subtle">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-sm font-medium text-text-primary">Riepilogo Sessione AI</p>
            <p className="text-xs text-text-muted">Genera momenti salienti e suggerimenti di crescita</p>
          </div>
        </div>
        <button
          onClick={generateSessionSummary}
          disabled={generating}
          className="btn btn-primary text-sm"
        >
          {generating ? (
            <>
              <span className="animate-spin mr-1">⟳</span>
              Generando...
            </>
          ) : (
            'Genera Riepilogo'
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-3 py-2 rounded-lg text-sm mt-2">
          {error}
        </div>
      )}
      
      {summary && (
        <div className="mt-4 space-y-4">
          {/* Highlights */}
          {summary.highlights && summary.highlights.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">⭐ Momenti Salienti</h4>
              <ul className="space-y-1">
                {summary.highlights.map((h, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="text-accent-primary">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Best Moment */}
          {summary.bestMoment && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">🌟 Momento Migliore</h4>
              <div className="bg-bg-secondary rounded p-3 border border-border-subtle">
                <p className="text-sm font-medium text-accent-primary">{summary.bestMoment.title}</p>
                <p className="text-sm text-text-secondary mt-1">{summary.bestMoment.description}</p>
              </div>
            </div>
          )}
          
          {/* Character Growth */}
          {summary.characterGrowth && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">📈 Crescita del Personaggio</h4>
              <div className="bg-bg-secondary rounded p-3 border border-border-subtle space-y-2">
                {summary.characterGrowth.newTrait && (
                  <div>
                    <span className="text-xs text-text-muted">Nuovo tratto:</span>
                    <p className="text-sm text-text-secondary">{summary.characterGrowth.newTrait}</p>
                  </div>
                )}
                {summary.characterGrowth.lessonLearned && (
                  <div>
                    <span className="text-xs text-text-muted">Lezione imparata:</span>
                    <p className="text-sm text-text-secondary">{summary.characterGrowth.lessonLearned}</p>
                  </div>
                )}
                {summary.characterGrowth.futureDirection && (
                  <div>
                    <span className="text-xs text-text-muted">Direzione futura:</span>
                    <p className="text-sm text-text-secondary">{summary.characterGrowth.futureDirection}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Letter Generator Modal ─────────────────────────────────────────────────

function LetterGeneratorModal({ sessionId, characterId, characterName, onClose }) {
  const [recipient, setRecipient] = useState('');
  const [purpose, setPurpose] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate(e) {
    e.preventDefault();
    if (!recipient.trim()) { setError('Inserisci il destinatario della lettera'); return; }

    setGenerating(true);
    setError('');
    try {
      const res = await window.gen.generate({
        sessionId,
        characterId,
        type: 'letter',
        params: { recipient: recipient.trim(), purpose: purpose.trim() },
      });
      if (!res.ok) throw new Error(res.error || 'Errore nella generazione');
      onClose(true); // pass true = refresh content
    } catch (err) {
      setError(err.message || 'Errore nella generazione della lettera');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="bg-bg-secondary border border-border-subtle rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            <h3 className="text-lg font-bold text-text-primary">Genera Lettera</h3>
          </div>
          <button onClick={() => onClose(false)} className="text-text-muted hover:text-text-primary text-xl">×</button>
        </div>
        <p className="text-text-muted text-sm mb-4">
          {characterName} scriverà una lettera dal proprio punto di vista.
        </p>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Destinatario *</label>
            <input
              type="text"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="Es: mio padre, il Re, il mercante..."
              className="w-full bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
              disabled={generating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Scopo / Contesto</label>
            <textarea
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="Es: ringraziare per il dono ricevuto, lamentarsi di un torto subito..."
              rows={3}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none"
              disabled={generating}
            />
          </div>
          {error && (
            <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-1 btn btn-secondary text-sm"
              disabled={generating}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 btn btn-primary text-sm disabled:opacity-50"
              disabled={generating}
            >
              {generating ? 'Genero...' : 'Genera Lettera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SessionSummary({ sessionId, campaignId, characterId, onDone }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [genKey, setGenKey] = useState(0); // bump to force-refresh after generation
  const [character, setCharacter] = useState(null);
  const [summaryGenerated, setSummaryGenerated] = useState(false);

  // Fetch character + generated content for this character
  useEffect(() => {
    async function load() {
      try {
        // Load character profile (for writing_talent check)
        const charRes = await window.db.characters.get(characterId);
        if (charRes.ok) setCharacter(charRes.data);

        // Load generated content
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
  }, [characterId, genKey]);

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
  const canGenerateLetter = character?.writing_talent === 1 || character?.writing_talent === true;

  /**
   * Save generated content item to character profile
   */
  async function handleSaveToProfile(item) {
    if (!character) return;
    
    try {
      let updateData = {};
      
      switch (item.type) {
        case 'catchphrase':
          updateData.catchphrase = item.content;
          break;
        case 'journal':
          // Add to biography notes
          updateData.notes = [...(character.notes || []), {
            id: `note-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            category: 'session',
            content: `📔 ${item.content}`,
          }];
          break;
        case 'memory':
          // Add as timeline entry or note
          updateData.notes = [...(character.notes || []), {
            id: `note-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            category: 'memory',
            content: `💭 ${item.content}`,
          }];
          break;
        case 'highlight':
          updateData.notes = [...(character.notes || []), {
            id: `note-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            category: 'highlight',
            content: `⭐ ${item.content}`,
          }];
          break;
        case 'growth':
          try {
            const growth = JSON.parse(item.content);
            updateData.notes = [...(character.notes || []), {
              id: `note-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              category: 'growth',
              content: `📈 Crescita: ${growth.newTrait || ''} - ${growth.lessonLearned || ''}`,
            }];
          } catch {
            updateData.notes = [...(character.notes || []), {
              id: `note-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              category: 'growth',
              content: `📈 ${item.content}`,
            }];
          }
          break;
        default:
          updateData.notes = [...(character.notes || []), {
            id: `note-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            category: item.type,
            content: item.content,
          }];
      }
      
      await window.db.characters.update({ id: characterId, ...updateData });
      
      // Update local state
      setCharacter(prev => ({ ...prev, ...updateData }));
      
      // Show toast — use static import from Toast module
      import('../Toast').then(({ toast }) => {
        toast('Contenuto salvato nel profilo!', 'success');
      });
    } catch (err) {
      console.error('Error saving to profile:', err);
      import('../Toast').then(({ toast }) => {
        toast('Errore nel salvataggio', 'error');
      });
    }
  }

  return (
    <>
    <div className="card border border-yellow-600/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-600/20 border border-yellow-600/40 flex items-center justify-center text-xl">✨</div>
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

      {/* Session Summary Generator */}
      {!loading && !summaryGenerated && (
        <div className="mb-6">
          <SessionSummaryGenerator
            sessionId={sessionId}
            characterId={characterId}
            character={character}
            onGenerated={() => {
              setSummaryGenerated(true);
              setGenKey(k => k + 1);
            }}
          />
        </div>
      )}

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

      {/* Letter action bar */}
      {!loading && canGenerateLetter && (
        <div className="flex items-center justify-between mb-6 p-3 bg-bg-tertiary rounded-lg border border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <div>
              <p className="text-sm font-medium text-text-primary">Talenti di scrittura</p>
              <p className="text-xs text-text-muted">{character?.name} sa scrivere lettere</p>
            </div>
          </div>
          <button
            onClick={() => setShowLetterModal(true)}
            className="btn btn-primary text-sm"
          >
            + Genera Lettera
          </button>
        </div>
      )}

      {/* Content grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map(item => (
            <ContentCard 
              key={item.id} 
              item={item} 
              onSaveToProfile={handleSaveToProfile}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && contents.length === 0 && !canGenerateLetter && (
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

    {showLetterModal && (
      <LetterGeneratorModal
        sessionId={sessionId}
        characterId={characterId}
        characterName={character?.name ?? 'Il personaggio'}
        onClose={(shouldRefresh) => {
          setShowLetterModal(false);
          if (shouldRefresh) setGenKey(k => k + 1);
        }}
      />
    )}
    </>
  );
}
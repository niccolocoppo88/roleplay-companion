import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CharacterModal from '../components/CharacterModal';
import DiceRoller from '../components/DiceRoller';
import NotesPanel from '../components/NotesPanel';
import { toast } from '../components/Toast';

function CharacterSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="card">
          <div className="flex items-center gap-4">
            <div className="skeleton-avatar w-12 h-12" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-title" />
              <div className="skeleton-text w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCharacters({ onCreate }) {
  return (
    <div className="text-center py-12 border border-dashed border-border-primary rounded-lg">
      <p className="text-4xl mb-3">⚔️</p>
      <h3 className="text-lg font-semibold text-text-primary mb-1">Nessun personaggio</h3>
      <p className="text-text-secondary text-sm mb-4">Crea il tuo primo personaggio per questa campagna</p>
      <button onClick={onCreate} className="btn btn-primary">+ Crea PG</button>
    </div>
  );
}

function CampaignDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 text-sm text-text-muted mb-4">
        <div className="skeleton w-16 h-4" />
        <div className="skeleton w-4 h-4" />
        <div className="skeleton w-32 h-4" />
      </div>
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="skeleton-title w-48" />
          <div className="skeleton-text w-64" />
        </div>
        <div className="skeleton w-32 h-10" />
      </div>
      <div className="skeleton-title w-32 mb-4" />
      <CharacterSkeleton />
    </div>
  );
}

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCharModal, setShowCharModal] = useState(false);

  useEffect(() => {
    async function load() {
      const campRes = await window.db.campaigns.get(campaignId);
      if (campRes.ok) setCampaign(campRes.data);
      const charRes = await window.db.characters.list(campaignId);
      if (charRes.ok) setCharacters(charRes.data);
      setLoading(false);
    }
    load();
  }, [campaignId]);

  async function handleCreateChar(data) {
    await window.db.characters.create(data);
    setShowCharModal(false);
    toast('Personaggio creato con successo!', 'success');
    const charRes = await window.db.characters.list(campaignId);
    if (charRes.ok) setCharacters(charRes.data);
  }

  if (loading) return <CampaignDetailSkeleton />;
  if (!campaign) return <div className="p-6 text-text-secondary">Campagna non trovata</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 text-sm text-text-muted mb-4">
        <Link to="/" className="hover:text-accent-primary">Campagne</Link>
        <span>/</span>
        <span className="text-text-secondary">{campaign.name}</span>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{campaign.name}</h1>
          {campaign.description && <p className="text-text-secondary mt-1">{campaign.description}</p>}
        </div>
        <button onClick={() => setShowCharModal(true)} className="btn btn-primary">+ Nuovo PG</button>
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Personaggi</h2>
      {characters.length === 0 ? (
        <EmptyCharacters onCreate={() => setShowCharModal(true)} />
      ) : (
        <div className="grid gap-4">
          {characters.map(c => {
            const hpMax = c.hp_max || 0;
            const hpCurrent = c.hp_current || 0;
            const hpPercent = hpMax > 0 ? Math.round((hpCurrent / hpMax) * 100) : 100;
            const activeConditions = (() => { try { return JSON.parse(c.conditions || '[]'); } catch { return []; } })();
            
            return (
              <Link
                key={c.id}
                to={`/campaigns/${campaignId}/characters/${c.id}`}
                className="card card-hover hover:border-border-hover"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-border-primary flex items-center justify-center text-xl overflow-hidden">
                    {c.portrait ? (
                      <img src={c.portrait} alt="" className="w-full h-full object-cover" />
                    ) : '⚔️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-text-primary">{c.name}</h3>
                      {c.inspiration > 0 && (
                        <span className="text-accent-gold text-xs" title="Ispirazione">✨ {c.inspiration}</span>
                      )}
                      {activeConditions.length > 0 && (
                        <div className="flex gap-1">
                          {activeConditions.slice(0, 2).map(cond => (
                            <span key={cond} className="text-xs px-1.5 py-0.5 rounded bg-accent-danger/20 text-accent-danger" title={cond}>
                              ⚠️
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-text-secondary text-sm">{c.race} {c.class} • Livello {c.level}</p>
                    
                    {/* HP Bar */}
                    {hpMax > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-text-muted">HP:</span>
                        <div className="flex-1 max-w-32 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${hpPercent > 50 ? 'bg-accent-success' : hpPercent > 25 ? 'bg-yellow-600' : 'bg-accent-danger'}`}
                            style={{ width: `${Math.min(100, hpPercent)}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted font-mono">{hpCurrent}/{hpMax}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-text-muted">→</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {showCharModal && (
        <CharacterModal
          mode="create"
          campaignId={campaignId}
          onSave={handleCreateChar}
          onClose={() => setShowCharModal(false)}
        />
      )}

      {/* Dice Roller */}
      <DiceRoller sessionId={null} characterId={null} />

      {/* Quick Notes Panel */}
      <NotesPanel campaignId={campaignId} />
    </div>
  );
}
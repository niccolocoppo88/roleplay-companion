import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import CampaignDashboard from './pages/CampaignDashboard';
import CampaignDetail from './pages/CampaignDetail';
import CharacterProfile from './pages/CharacterProfile';
import ActiveSession from './components/session/ActiveSession';
import SessionSummary from './components/session/SessionSummary';
import CampaignModal from './components/CampaignModal';
import CharacterModal from './components/CharacterModal';
import ConfirmDialog from './components/ConfirmDialog';
import ToastContainer from './components/Toast';
import DiceRoller from './components/DiceRoller';
import NotesPanel from './components/NotesPanel';
import SettingsPanel from './components/SettingsPanel';
import SessionRating from './components/SessionRating';
import CharacterMoodSelector from './components/CharacterMoodSelector';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Active session state — lives at App level so it persists across nav
  const [activeSession, setActiveSession] = useState(null);
  // Session summary shown after a session ends
  const [sessionSummary, setSessionSummary] = useState(null);
  // Session rating shown after session ends
  const [showRating, setShowRating] = useState(false);
  const [lastSessionData, setLastSessionData] = useState(null);
  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  // Character modal state (for keyboard shortcut Cmd+Shift+N)
  const [showCreateCharacter, setShowCreateCharacter] = useState(false);
  const [characterModalCampaignId, setCharacterModalCampaignId] = useState(null);
  // Quick create FAB menu
  const [showFabMenu, setShowFabMenu] = useState(false);
  // Keyboard shortcuts help
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Keyboard shortcuts
  const modalOpen = showCreate || editTarget || deleteTarget || showCreateCharacter || sessionSummary;
  useKeyboardShortcuts({
    onNewCampaign: () => setShowCreate(true),
    onNewCharacter: () => {
      // Only open character modal if we have a campaign context
      if (characterModalCampaignId) {
        setShowCreateCharacter(true);
      }
    },
    modalOpen,
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      const res = await window.db.campaigns.list();
      if (res.ok) setCampaigns(res.data);
      else setError(res.error || 'Errore nel caricamento');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data) {
    await window.db.campaigns.create(data);
    setShowCreate(false);
    await loadCampaigns();
  }

  async function handleEdit(data) {
    await window.db.campaigns.update({ id: editTarget.id, ...data });
    setEditTarget(null);
    await loadCampaigns();
  }

  async function handleDelete(id) {
    await window.db.campaigns.delete(id);
    setDeleteTarget(null);
    await loadCampaigns();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-primary bg-bg-secondary sticky top-0 z-30">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🎭</span>
            <div>
              <h1 className="text-lg font-bold text-text-primary leading-tight">Roleplay Companion</h1>
              <p className="text-text-muted text-xs">Assistente D&D</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {/* Keyboard shortcuts help button */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="text-text-muted hover:text-text-primary text-sm p-2 rounded-lg hover:bg-bg-tertiary transition-colors font-medium"
              title="Scorciatoie da tastiera"
            >
              ?
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-text-muted hover:text-text-primary text-xl p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
              title="Impostazioni"
            >
              ⚙️
            </button>
            {activeSession && (
              <div className="flex items-center gap-2 bg-accent-success/10 border border-accent-success/30 rounded-full px-3 py-1">
                <div className="w-2 h-2 rounded-full bg-accent-success animate-pulse" />
                <span className="text-accent-success text-xs font-medium">Meet attivo</span>
                <button
                  onClick={() => setActiveSession(null)}
                  className="text-text-muted hover:text-text-primary text-xs ml-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-5xl mx-auto">
        {error && (
          <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <Routes>
          <Route path="/" element={<DashboardView campaigns={campaigns} activeSession={activeSession} setActiveSession={setActiveSession} showCreate={showCreate} setShowCreate={setShowCreate} editTarget={editTarget} setEditTarget={setEditTarget} deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget} onCreate={handleCreate} onEdit={handleEdit} onDelete={handleDelete} />} />
          <Route path="/campaigns/:campaignId" element={<CampaignDetailWrapper onStartSession={setActiveSession} onSetCharacterCampaignId={setCharacterModalCampaignId} />} />
          <Route path="/campaigns/:campaignId/characters/:characterId" element={<CharacterProfileWrapper onStartSession={setActiveSession} />} />
          <Route path="/characters/:characterId" element={<CharacterProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Modals */}
      {showCreate && (
        <CampaignModal mode="create" onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {editTarget && (
        <CampaignModal mode="edit" initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Campagna"
          message={`Sei sicuro di voler eliminare "${deleteTarget.name}"? Questa azione non può essere annullata.`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Character Creation Modal */}
      {showCreateCharacter && characterModalCampaignId && (
        <CharacterModal
          mode="create"
          campaignId={characterModalCampaignId}
          onSave={async (data) => {
            await window.db.characters.create(data);
            setShowCreateCharacter(false);
            setCharacterModalCampaignId(null);
          }}
          onClose={() => {
            setShowCreateCharacter(false);
            setCharacterModalCampaignId(null);
          }}
        />
      )}

      {/* Session Summary — shown after a session ends */}
      {sessionSummary && (
        <SessionSummary
          sessionId={sessionSummary.sessionId}
          campaignId={sessionSummary.campaignId}
          characterId={sessionSummary.characterId}
          onDone={() => {
            setSessionSummary(null);
            // Show rating after summary is closed with session data
            setLastSessionData({
              sessionId: sessionSummary.sessionId,
              campaignId: sessionSummary.campaignId,
              characterId: sessionSummary.characterId,
            });
            setShowRating(true);
          }}
        />
      )}

      {/* Session Rating — shown after session summary is dismissed */}
      {showRating && lastSessionData && (
        <div className="fixed bottom-4 right-4 z-50 w-80">
          <SessionRating
            sessionId={lastSessionData.sessionId}
            onRate={() => {
              setShowRating(false);
              setLastSessionData(null);
            }}
          />
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Toast notifications */}
      <ToastContainer />

      {/* Floating dice roller */}
      <DiceRoller sessionId={activeSession?.sessionId} />

      {/* Quick notes panel - needs campaign context */}
      {campaigns.length > 0 && (
        <NotesPanel campaignId={activeSession?.campaignId || 'default'} />
      )}

      {/* Floating Action Button (FAB) - Quick Create */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {showFabMenu && (
          <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-xl p-2 flex flex-col gap-1 mb-2">
            <button
              onClick={() => { setShowCreate(true); setShowFabMenu(false); }}
              className="fab-menu-item flex items-center gap-2 px-4 py-2 rounded-md hover:bg-bg-tertiary text-text-primary text-sm w-full text-left"
            >
              <span>📜</span> Nuova Campagna
            </button>
            <button
              onClick={() => { /* opens character modal if context available */ setShowFabMenu(false); }}
              className="fab-menu-item flex items-center gap-2 px-4 py-2 rounded-md hover:bg-bg-tertiary text-text-primary text-sm w-full text-left"
            >
              <span>👤</span> Nuovo Personaggio
            </button>
            <button
              onClick={() => { /* trigger dice roller */ setShowFabMenu(false); }}
              className="fab-menu-item flex items-center gap-2 px-4 py-2 rounded-md hover:bg-bg-tertiary text-text-primary text-sm w-full text-left"
            >
              <span>🎲</span> Lancia Dadi
            </button>
          </div>
        )}
        <button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`fab-enter w-14 h-14 rounded-full bg-accent-primary text-bg-primary flex items-center justify-center text-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all ${showFabMenu ? 'rotate-45' : ''}`}
          title="Azioni rapide"
        >
          +
        </button>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 modal-blur" onClick={() => setShowShortcuts(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-6 w-96 max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">Scorciatoie da Tastiera</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-text-muted hover:text-text-primary text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Nuova campagna</span>
                <kbd className="px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-primary font-mono">⌘N</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Nuovo personaggio</span>
                <kbd className="px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-primary font-mono">⌘⇧N</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Chiudi modal</span>
                <kbd className="px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-primary font-mono">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard View ──────────────────────────────────────────────────────────

function DashboardView({ campaigns, activeSession, setActiveSession, showCreate, setShowCreate, editTarget, setEditTarget, deleteTarget, setDeleteTarget, onCreate, onEdit, onDelete }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredCampaigns = campaigns.filter(c => 
    !searchQuery || 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-primary">
          Campagne
          <span className="ml-2 text-sm font-normal text-text-muted">({filteredCampaigns.length})</span>
        </h2>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Nuova Campagna</button>
      </div>

      {/* Search/Filter Bar */}
      {campaigns.length > 0 && (
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-text-muted">🔍</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca campagna..."
            className="input pl-10 bg-bg-tertiary border-border-primary"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📜</div>
          <p className="text-text-secondary text-lg">Nessuna campagna creata</p>
          <p className="text-text-muted text-sm mt-1">Clicca su "Nuova Campagna" per iniziare</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-text-secondary">Nessuna campagna trovata per "{searchQuery}"</p>
          <button onClick={() => setSearchQuery('')} className="btn btn-secondary mt-3">Pulisci ricerca</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCampaigns.map(campaign => (
            <CampaignCardEnhanced
              key={campaign.id}
              campaign={campaign}
              onEdit={c => setEditTarget(c)}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              onStartSession={(campId) => setActiveSession({ campaignId: campId })}
            />
          ))}
        </div>
      )}

      {activeSession && (
        <div className="mt-6">
          <ActiveSession
            campaignId={activeSession.campaignId}
            characterId={activeSession.characterId}
            onSessionEnd={(data) => {
              setActiveSession(null);
              setSessionSummary(data);
            }}
          />
        </div>
      )}
    </>
  );
}

// ─── Enhanced Campaign Card ──────────────────────────────────────────────────

function CampaignCardEnhanced({ campaign, onEdit, onDelete, onStartSession }) {
  const [characterCount, setCharacterCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastSession, setLastSession] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const charRes = await window.db.characters.list(campaign.id);
        if (charRes.ok) setCharacterCount(charRes.data.length);
        
        // Get sessions for this campaign
        const sessionRes = await window.db.sessions?.list?.(campaign.id);
        if (sessionRes?.ok) {
          const sessions = sessionRes.data;
          setSessionCount(sessions.length);
          if (sessions.length > 0) {
            const sorted = [...sessions].sort((a, b) => 
              new Date(b.date || b.created_at) - new Date(a.date || a.created_at)
            );
            setLastSession(sorted[0]);
          }
        }
      } catch { /* ignore */ }
    }
    loadStats();
  }, [campaign.id]);

  const formatLastActive = (date) => {
    if (!date) return 'Mai';
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Oggi';
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7) return `${diffDays} giorni fa`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  // Compute campaign health based on recent activity
  const getCampaignHealth = () => {
    if (!lastSession) return 'danger'; // Never had a session
    const diffDays = Math.floor((new Date() - new Date(lastSession?.date || lastSession?.created_at)) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) return 'healthy';
    if (diffDays <= 14) return 'warning';
    return 'danger';
  };

  const health = getCampaignHealth();

  return (
    <div className="card-gradient card-gradient-hover group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text-primary truncate flex items-center gap-2">{campaign.name}
            <span className={`health-dot ${health}`} title={`Stato: ${health === 'healthy' ? 'Attivo' : health === 'warning' ? 'Pausa' : 'Inattivo'}`}></span>
          </h3>
          {campaign.description && (
            <p className="text-text-secondary text-sm mt-1 line-clamp-2">{campaign.description}</p>
          )}
          
          {/* Campaign Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>👤</span>
              <span>{characterCount} PG</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>🎭</span>
              <span>{sessionCount} sessioni</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>🕐</span>
              <span>Attivo: {formatLastActive(lastSession?.date || campaign.updated_at)}</span>
            </div>
          </div>
          
          {campaign.created_at && (
            <p className="text-text-muted text-xs mt-2">
              Creato il {new Date(campaign.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <button
            onClick={() => onStartSession(campaign.id)}
            className="btn btn-primary text-sm flex items-center gap-1.5"
            title="Avvia sessione Meet"
          >
            <span>▶</span>
            <span>Start</span>
          </button>
          <Link 
            to={`/campaigns/${campaign.id}`} 
            className="btn btn-secondary text-sm"
          >
            Apri
          </Link>
          <button onClick={() => onEdit(campaign)} className="text-text-muted hover:text-text-primary p-1.5" title="Modifica">✏️</button>
          <button onClick={() => onDelete(campaign.id, campaign.name)} className="text-text-muted hover:text-accent-danger p-1.5" title="Elimina">🗑</button>
        </div>
      </div>
    </div>
  );
}

// ─── CampaignCard (legacy) ────────────────────────────────────────────────────

function CampaignCard({ campaign, onEdit, onDelete, onStartSession }) {
  return (
    <div className="card hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-text-primary">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-text-secondary text-sm mt-1 line-clamp-2">{campaign.description}</p>
          )}
          <p className="text-text-muted text-xs mt-2">
            Creata il {new Date(campaign.created_at).toLocaleDateString('it-IT')}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onStartSession(campaign.id)}
            className="btn btn-secondary text-sm"
            title="Avvia sessione Meet"
          >
            🎙 Meet
          </button>
          <Link to={`/campaigns/${campaign.id}`} className="btn btn-secondary text-sm">Apri</Link>
          <button onClick={() => onEdit(campaign)} className="text-text-muted hover:text-text-primary p-1" title="Modifica">✏️</button>
          <button onClick={() => onDelete(campaign.id, campaign.name)} className="text-text-muted hover:text-accent-danger p-1" title="Elimina">🗑</button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Detail ──────────────────────────────────────────────────────────

// We need to pass setCharacterModalCampaignId through the component tree
function CampaignDetailWrapper({ onStartSession, parentCampaignId, onSetCharacterCampaignId }) {
  const { campaignId } = useParams();
  
  // When this component mounts, set the campaign ID for character creation
  useEffect(() => {
    onSetCharacterCampaignId?.(campaignId);
  }, [campaignId, onSetCharacterCampaignId]);
  
  return <CampaignDetailUpgraded campaignId={campaignId} onStartSession={onStartSession} />;
}

function CampaignDetailUpgraded({ campaignId, onStartSession }) {
  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [showCreateChar, setShowCreateChar] = useState(false);
  const [showSession, setShowSession] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await window.db.campaigns.get(campaignId);
      if (res.ok) setCampaign(res.data);
      const charRes = await window.db.characters.list(campaignId);
      if (charRes.ok) setCharacters(charRes.data);
    }
    load();
  }, [campaignId]);

  if (!campaign) return <div className="text-text-secondary p-6">Caricamento...</div>;

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
        <div className="flex gap-2">
          <button onClick={() => setShowSession(true)} className="btn btn-primary">🎙 Avvia Sessione</button>
          <button onClick={() => setShowCreateChar(true)} className="btn btn-secondary">+ Nuovo PG</button>
        </div>
      </div>

      {showSession && (
        <div className="mb-6">
          <button onClick={() => setShowSession(false)} className="text-text-muted text-sm mb-2 hover:text-text-secondary">✕ annulla</button>
          <ActiveSession campaignId={campaignId} characterId={null} onSessionEnd={() => setShowSession(false)} />
        </div>
      )}

      <h2 className="text-lg font-semibold text-text-primary mb-4">Personaggi</h2>
      {characters.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-4xl mb-3">⚔️</p>
          <p>Nessun personaggio ancora</p>
          <button onClick={() => setShowCreateChar(true)} className="btn btn-primary mt-3">Crea il primo PG</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {characters.map(c => (
            <Link key={c.id} to={`/campaigns/${campaignId}/characters/${c.id}`} className="card hover:border-border-hover transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-border-primary flex items-center justify-center text-xl">⚔️</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary">{c.name}</h3>
                  <p className="text-text-secondary text-sm">{c.race} {c.class}</p>
                </div>
                <button onClick={(e) => { e.preventDefault(); setShowSession(true); }} className="btn btn-secondary text-xs" title="Avvia sessione">🎙</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Character Profile ────────────────────────────────────────────────────────

function CharacterProfileWrapper({ onStartSession }) {
  const { campaignId, characterId } = useParams();
  return <CharacterProfileUpgraded campaignId={campaignId} characterId={characterId} onStartSession={onStartSession} />;
}

function CharacterProfileUpgraded({ campaignId, characterId, onStartSession }) {
  const [character, setCharacter] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    async function load() {
      const res = await window.db.characters.get(characterId);
      if (res.ok) setCharacter(res.data);
    }
    load();
  }, [characterId]);

  if (!character) return <div className="text-text-secondary p-6">Caricamento...</div>;

  const tabs = [
    { id: 'stats', label: 'Scheda', icon: '📋' },
    { id: 'biography', label: 'Biografia', icon: '📖' },
    { id: 'inventory', label: 'Inventario', icon: '🎒' },
    { id: 'notes', label: 'Note', icon: '📝' },
  ];

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center gap-3 text-sm text-text-muted mb-2">
          <Link to="/" className="hover:text-accent-primary">Campagne</Link>
          <span>/</span>
          <Link to={`/campaigns/${campaignId}`} className="hover:text-accent-primary">{campaignId}</Link>
          <span>/</span>
          <span className="text-text-secondary">{character.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary border-2 border-border-primary flex items-center justify-center text-2xl">⚔️</div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{character.name}</h1>
              <p className="text-text-secondary">{character.race} {character.class}</p>
            </div>
          </div>
          <button onClick={() => onStartSession({ campaignId, characterId })} className="btn btn-primary">🎙 Avvia Sessione Meet</button>
        </div>
      </header>

      <div className="bg-bg-secondary border-b border-border-primary px-6">
        <nav className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id ? 'text-accent-primary border-accent-primary' : 'text-text-muted border-transparent hover:text-text-secondary'}`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Statistiche</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <p className="text-text-muted text-xs">Classe</p>
                  <p className="text-text-primary font-semibold">{character.class || '-'}</p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <p className="text-text-muted text-xs">Razza</p>
                  <p className="text-text-primary font-semibold">{character.race || '-'}</p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <p className="text-text-muted text-xs">Livello</p>
                  <p className="text-text-primary font-semibold">{character.level || 1}</p>
                </div>
              </div>
            </div>
            {character.backstory && (
              <div className="card">
                <h3 className="text-lg font-semibold text-text-primary mb-2">Background</h3>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{character.backstory}</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'biography' && <div className="card"><p className="text-text-muted">Biografia non ancora compilata.</p></div>}
        {activeTab === 'inventory' && <div className="card"><p className="text-text-muted">Inventario vuoto.</p></div>}
        {activeTab === 'notes' && <div className="card"><p className="text-text-muted">Note vuote.</p></div>}
      </main>
    </div>
  );
}

export default App;
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import CampaignDashboard from './pages/CampaignDashboard';
import CampaignDetail from './pages/CampaignDetail';
import CharacterProfile from './pages/CharacterProfile';
import ActiveSession from './components/session/ActiveSession';
import SessionSummary from './components/session/SessionSummary';
import CampaignModal from './components/CampaignModal';
import ConfirmDialog from './components/ConfirmDialog';

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
          <Route path="/campaigns/:campaignId" element={<CampaignDetailWrapper onStartSession={setActiveSession} />} />
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

      {/* Session Summary — shown after a session ends */}
      {sessionSummary && (
        <SessionSummary
          sessionId={sessionSummary.sessionId}
          campaignId={sessionSummary.campaignId}
          characterId={sessionSummary.characterId}
          onDone={() => setSessionSummary(null)}
        />
      )}
    </div>
  );
}

// ─── Dashboard View ──────────────────────────────────────────────────────────

function DashboardView({ campaigns, activeSession, setActiveSession, showCreate, setShowCreate, editTarget, setEditTarget, deleteTarget, setDeleteTarget, onCreate, onEdit, onDelete }) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-primary">
          Campagne
          <span className="ml-2 text-sm font-normal text-text-muted">({campaigns.length})</span>
        </h2>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Nuova Campagna</button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📜</div>
          <p className="text-text-secondary text-lg">Nessuna campagna creata</p>
          <p className="text-text-muted text-sm mt-1">Clicca su "Nuova Campagna" per iniziare</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(campaign => (
            <CampaignCard
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

// ─── CampaignCard ────────────────────────────────────────────────────────────

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

function CampaignDetailWrapper({ onStartSession }) {
  const { campaignId } = useParams();
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
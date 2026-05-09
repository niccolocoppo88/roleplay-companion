import React, { useState, useEffect } from 'react';
import CampaignCard from './components/CampaignCard';
import CampaignModal from './components/CampaignModal';
import ConfirmDialog from './components/ConfirmDialog';

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      const rows = await window.electronAPI.campaigns.list();
      setCampaigns(rows);
      setError('');
    } catch (err) {
      setError('Errore nel caricamento delle campagne: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data) {
    await window.electronAPI.campaigns.create(data);
    setShowCreate(false);
    await loadCampaigns();
  }

  async function handleEdit(data) {
    await window.electronAPI.campaigns.update({ id: editTarget.id, ...data });
    setEditTarget(null);
    await loadCampaigns();
  }

  async function handleDelete(id) {
    await window.electronAPI.campaigns.delete(id);
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
      <header className="border-b border-border-primary bg-bg-secondary">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Roleplay Companion</h1>
            <p className="text-text-muted text-xs mt-0.5">Gestisci le tue campagne D&D</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-4xl mx-auto">
        {error && (
          <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text-primary">
            Campagne
            <span className="ml-2 text-sm font-normal text-text-muted">({campaigns.length})</span>
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary"
          >
            + Nuova Campagna
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📜</div>
            <p className="text-text-secondary text-lg">Nessuna campagna creata</p>
            <p className="text-text-muted text-sm mt-1">
              Clicca su "Nuova Campagna" per iniziare
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={c => setEditTarget(c)}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreate && (
        <CampaignModal
          mode="create"
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editTarget && (
        <CampaignModal
          mode="edit"
          initial={editTarget}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina Campagna"
          message={`Sei sicuro di voler eliminare "${deleteTarget.name}"? Questa azione non può essere annullata.`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default App;
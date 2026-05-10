import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function CampaignSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="card">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <div className="skeleton-title" />
              <div className="skeleton-text w-full" />
              <div className="skeleton-text w-1/2" />
            </div>
            <div className="flex gap-2 ml-4">
              <div className="skeleton w-16 h-8" />
              <div className="skeleton w-12 h-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">📜</div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">Nessuna campagna ancora</h3>
      <p className="text-text-secondary mb-6 max-w-md mx-auto">
        Le tue avventure ti aspettano! Crea la tua prima campagna per iniziare a gestire personaggi e sessioni.
      </p>
      <p className="text-text-muted text-sm">Clicca su "Nuova Campagna" per iniziare la tua avventura</p>
    </div>
  );
}

export default function CampaignDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await window.db.campaigns.list();
      if (res.ok) setCampaigns(res.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Campagne</h1>
        </div>
        <CampaignSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Campagne
          <span className="ml-2 text-sm font-normal text-text-muted">({campaigns.length})</span>
        </h1>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {campaigns.map(c => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className="card card-hover hover:border-border-hover"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{c.name}</h3>
                  {c.description && <p className="text-text-secondary text-sm mt-1">{c.description}</p>}
                  <p className="text-text-muted text-xs mt-2">
                    Creata il {new Date(c.created_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_CAMPAIGNS } from '../data/mockData';

export default function CampaignDashboard() {
  const [campaigns] = useState(MOCK_CAMPAIGNS);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Campagne</h1>
        <button onClick={() => setShowNew(true)} className="btn btn-primary">
          + Nuova Campagna
        </button>
      </div>
      <div className="grid gap-4">
        {campaigns.map(c => (
          <Link key={c.id} to={`/campaigns/${c.id}`} className="card hover:border-border-hover transition-colors">
            <h3 className="text-lg font-semibold text-text-primary">{c.name}</h3>
            <p className="text-text-secondary text-sm mt-1">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
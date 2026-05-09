import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MOCK_CAMPAIGNS, MOCK_CHARACTERS } from '../data/mockData';

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const campaign = MOCK_CAMPAIGNS.find(c => c.id === campaignId) || MOCK_CAMPAIGNS[0];
  const characters = MOCK_CHARACTERS.filter(c => campaign.characters.includes(c.id));

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
          <p className="text-text-secondary mt-1">{campaign.description}</p>
        </div>
        <button className="btn btn-primary">+ Nuovo PG</button>
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Personaggi</h2>
      <div className="grid gap-4">
        {characters.map(c => (
          <Link
            key={c.id}
            to={`/campaigns/${campaignId}/characters/${c.id}`}
            className="card hover:border-border-hover transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-border-primary flex items-center justify-center text-xl">
                ⚔️
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{c.name}</h3>
                <p className="text-text-secondary text-sm">{c.race} {c.class} • Livello {c.level}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
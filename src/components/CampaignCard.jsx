import React from 'react';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CampaignCard({ campaign, onEdit, onDelete }) {
  return (
    <div className="card hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text-primary truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-text-secondary text-sm mt-1 line-clamp-2">{campaign.description}</p>
          )}
          <p className="text-text-muted text-xs mt-2">
            Creato il {formatDate(campaign.created_at)}
          </p>
        </div>

        <div className="flex gap-2 ml-4 flex-shrink-0">
          <button
            onClick={() => onEdit(campaign)}
            className="btn btn-secondary text-sm px-3 py-1"
            title="Modifica"
          >
            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(campaign.id, campaign.name)}
            className="btn btn-danger text-sm px-3 py-1"
            title="Elimina"
          >
            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
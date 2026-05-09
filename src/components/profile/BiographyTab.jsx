import React from 'react';

export default function BiographyTab({ biography }) {
  return (
    <div className="p-6 grid grid-cols-12 gap-6">
      {/* Left: Appearance + Identity */}
      <div className="col-span-4 space-y-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Identità</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <BioField label="Età" value={biography.age} />
            <BioField label="Altezza" value={biography.height} />
            <BioField label="Peso" value={biography.weight} />
            <BioField label="Occhi" value={biography.eyes} />
            <BioField label="Capelli" value={biography.hair} />
            <BioField label="Pelle" value={biography.skin} />
          </div>
        </div>
      </div>

      {/* Right: backstory + traits */}
      <div className="col-span-8 space-y-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Background</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{biography.backstory}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Tratti Personality</h3>
            <p className="text-sm text-text-primary italic">"{biography.personalityTraits}"</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Ideali</h3>
            <p className="text-sm text-text-primary">{biography.ideals}</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Legami</h3>
            <p className="text-sm text-text-primary">{biography.bonds}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Difetti</h3>
            <p className="text-sm text-text-primary">{biography.flaws}</p>
          </div>
          <div className="card border-l-2 border-l-accent-danger">
            <h3 className="text-sm font-semibold text-accent-danger uppercase tracking-wide mb-2">Paure</h3>
            <p className="text-sm text-text-primary">{biography.fears}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BioField({ label, value }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  );
}
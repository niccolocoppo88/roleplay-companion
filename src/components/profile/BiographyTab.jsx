import React, { useState } from 'react';

// Visual timeline events that can be displayed alongside biography
const BIO_TIMELINE_EVENTS = [
  { key: 'birth', icon: '🌱', label: 'Nascita', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
  { key: 'childhood', icon: '🏠', label: 'Infanzia', color: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
  { key: 'training', icon: '⚔️', label: 'Allenamento', color: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
  { key: 'adulthood', icon: '🎭', label: 'Età Adulta', color: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
  { key: 'turning_point', icon: '⚡', label: 'Punto di Svolta', color: 'bg-rose-500/20 border-rose-500/40 text-rose-400' },
];

export default function BiographyTab({ biography, timeline = [] }) {
  const [activeEra, setActiveEra] = useState(null);

  // If timeline exists, extract life events
  const lifeEvents = timeline.length > 0 
    ? timeline.filter(e => ['birth', 'milestone'].includes(e.category))
    : [];

  return (
    <div className="p-6 grid grid-cols-12 gap-6">
      {/* Left: Identity + Life Events Timeline */}
      <div className="col-span-4 space-y-6">
        {/* Identity Card */}
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

        {/* Visual Life Timeline */}
        {lifeEvents.length > 0 ? (
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Linea Vitale</h3>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[1.125rem] top-3 bottom-3 w-0.5 bg-border-primary" />
              
              <div className="space-y-3">
                {lifeEvents.slice(0, 5).map((event, idx) => {
                  const era = BIO_TIMELINE_EVENTS[idx] || BIO_TIMELINE_EVENTS[0];
                  const isActive = activeEra === event.id;
                  
                  return (
                    <div
                      key={event.id || idx}
                      className={`
                        relative pl-10 cursor-pointer transition-all
                        ${isActive ? 'scale-[1.02]' : ''}
                      `}
                      onClick={() => setActiveEra(isActive ? null : event.id)}
                    >
                      {/* Icon bubble */}
                      <div className={`
                        absolute left-2 top-1 w-6 h-6 rounded-full border flex items-center justify-center text-xs
                        ${era.color}
                      `}>
                        {era.icon}
                      </div>
                      
                      <div className={`
                        bg-bg-tertiary rounded-lg p-2 border transition-all
                        ${isActive ? 'border-accent-primary/40' : 'border-transparent hover:border-border-hover'}
                      `}>
                        <p className="text-xs font-mono text-text-muted">{event.date}</p>
                        <p className="text-sm text-text-primary font-medium truncate">{event.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {lifeEvents.length > 5 && (
              <p className="text-xs text-text-muted mt-3 text-center">
                + {lifeEvents.length - 5} altri eventi nella timeline
              </p>
            )}
          </div>
        ) : (
          /* Empty life events - show placeholder */
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Linea Vitale</h3>
            <div className="relative">
              <div className="absolute left-[1.125rem] top-3 bottom-3 w-0.5 bg-border-primary" />
              <div className="space-y-3">
                {BIO_TIMELINE_EVENTS.map((era, idx) => (
                  <div key={era.key} className="relative pl-10">
                    <div className={`
                      absolute left-2 top-1 w-6 h-6 rounded-full border flex items-center justify-center text-xs
                      ${era.color} opacity-50
                    `}>
                      {era.icon}
                    </div>
                    <div className="bg-bg-tertiary/50 rounded-lg p-2 border border-dashed border-border-primary">
                      <p className="text-xs text-text-muted">—</p>
                      <p className="text-sm text-text-muted">{era.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-text-muted mt-3 text-center">
              Gli eventi appariranno qui man mano che vengono registrati
            </p>
          </div>
        )}
      </div>

      {/* Right: backstory + traits */}
      <div className="col-span-8 space-y-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Background</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {biography.backstory || (
              <span className="italic text-text-muted">
                Il background del personaggio apparirà qui dopo la generazione AI o l'inserimento manuale.
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Tratti Personality</h3>
            <p className="text-sm text-text-primary italic">"{biography.personalityTraits || '—'}"</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Ideali</h3>
            <p className="text-sm text-text-primary">{biography.ideals || '—'}</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Legami</h3>
            <p className="text-sm text-text-primary">{biography.bonds || '—'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Difetti</h3>
            <p className="text-sm text-text-primary">{biography.flaws || '—'}</p>
          </div>
          <div className="card border-l-2 border-l-accent-danger">
            <h3 className="text-sm font-semibold text-accent-danger uppercase tracking-wide mb-2">Paure</h3>
            <p className="text-sm text-text-primary">{biography.fears || '—'}</p>
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
      <div className="text-sm text-text-primary">{value || '—'}</div>
    </div>
  );
}
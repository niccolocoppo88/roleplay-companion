import React, { useState, useEffect } from 'react';

/**
 * SessionMoments - shows timeline of important moments marked during a session
 * Appears as a collapsible panel within the ActiveSession component
 */
export default function SessionMoments({ sessionId }) {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (sessionId) loadMoments();
  }, [sessionId]);

  async function loadMoments() {
    setLoading(true);
    try {
      const res = await window.db.moments.list(sessionId);
      if (res.ok) setMoments(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function formatDuration(ms) {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  if (!sessionId) return null;

  return (
    <div className="border-t border-border-primary pt-3 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-accent-gold">⭐</span>
          <span className="text-sm font-medium text-text-primary">Momenti Importanti</span>
          {moments.length > 0 && (
            <span className="text-xs text-text-muted">({moments.length})</span>
          )}
        </div>
        <span className="text-text-muted text-xs">{expanded ? '▲ nascondi' : '▼ mostra'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-text-muted text-xs text-center py-3">Caricamento...</p>
          ) : moments.length === 0 ? (
            <p className="text-text-muted text-xs text-center py-3">
              Nessun momento marcato. Clicca "⭐ Segna momento" durante il Meet.
            </p>
          ) : (
            moments.map((m, i) => (
              <div 
                key={m.id} 
                className="flex gap-3 p-2 rounded-lg bg-bg-tertiary/50 border border-border-subtle"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-gold mt-1.5" />
                  {i < moments.length - 1 && (
                    <div className="w-0.5 flex-1 bg-border-primary mt-1" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">
                      {formatTime(m.created_at)}
                    </span>
                    {m.timestamp_ms && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent-gold/20 text-accent-gold">
                        ⏱ {formatDuration(m.timestamp_ms)}
                      </span>
                    )}
                  </div>
                  {m.note && (
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2">{m.note}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
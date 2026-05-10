/**
 * src/components/session/ActiveSession.jsx
 *
 * UI for the active session panel — shows session status, join/stop controls,
 * and live transcript line count. Integrates with the Meet IPC handlers.
 * 
 * Enhanced with session moments timeline and dice roller integration.
 */
import React, { useState, useEffect, useCallback } from 'react';
import SessionMoments from '../SessionMoments';
import DiceRoller from '../DiceRoller';

const STATUS_COLORS = {
  active: 'bg-accent-success',
  ended: 'bg-text-muted',
  error: 'bg-accent-danger',
};

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}h ${m}m ${s}s`
    : `${m}m ${s}s`;
}

// ─── Sound Effects ───────────────────────────────────────────────────────────

const sounds = {
  success: null, // Will be created on demand
  notify: null,
};

// Initialize audio contexts lazily
function playSound(type) {
  try {
    // Simple beep using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'success') {
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    }
  } catch { /* ignore */ }
}

export { playSound };

export default function ActiveSession({ campaignId, characterId, onSessionEnd }) {
  const [meetUrl, setMeetUrl] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(null);   // null | 'active' | 'ended' | 'error'
  const [elapsed, setElapsed] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tick the elapsed timer while session is active
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await window.meetAPI.status(sessionId);
        if (res.ok) {
          setElapsed(res.data.elapsedSeconds);
          setLineCount(res.data.lineCount);
        } else if (res.data?.status === 'ended') {
          setStatus('ended');
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleJoin = useCallback(async () => {
    if (!meetUrl.trim()) {
      setError('Inserisci un URL Google Meet valido');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await window.meetAPI.join({
        url: meetUrl.trim(),
        campaignId,
        characterId,
      });
      if (res.ok) {
        setSessionId(res.data.sessionId);
        setStatus('active');
        setElapsed(0);
        setLineCount(0);
      } else {
        setError(res.error || 'Errore durante la connessione');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [meetUrl, campaignId, characterId]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await window.meetAPI.stop(sessionId);
      if (res.ok) {
        setStatus('ended');
        onSessionEnd?.({ sessionId, campaignId, characterId });
      } else {
        setError(res.error || 'Errore durante la chiusura');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, campaignId, characterId, onSessionEnd]);

  // ── Session is running ──────────────────────────────────────────────────────
  if (sessionId && status === 'active') {
    return (
      <div className="card border border-accent-success/50 card-gradient">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-accent-success animate-pulse" />
              <span className="absolute inset-0 rounded-full bg-accent-success opacity-50 animate-ping" />
            </div>
            <span className="text-accent-success font-semibold">Sessione Attiva</span>
            {/* Timer Badge */}
            <span className="ml-2 px-2 py-0.5 bg-bg-tertiary rounded text-xs font-mono text-text-secondary">
              ⏱ {formatElapsed(elapsed)}
            </span>
          </div>
          <button
            onClick={handleStop}
            disabled={loading}
            className="btn btn-danger text-sm"
          >
            {loading ? 'Chiusura...' : '⏹ Stop Sessione'}
          </button>
        </div>

        {/* Session info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-bg-tertiary rounded-lg p-3">
            <p className="text-text-muted text-xs mb-1">Durata</p>
            <p className="text-text-primary font-mono font-semibold">{formatElapsed(elapsed)}</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <p className="text-text-muted text-xs mb-1">Linee Transcript</p>
            <p className="text-text-primary font-mono font-semibold">{lineCount}</p>
          </div>
        </div>

        {/* Mark Important Moment Button */}
        <button 
          onClick={() => {
            const note = prompt('Nota per questo momento (opzionale):');
            try {
              window.db.moments.create({
                session_id: sessionId,
                note: note?.trim() || '',
                timestamp_ms: elapsed * 1000,
              });
              playSound('notify');
            } catch { /* ignore */ }
          }}
          className="moment-mark-btn w-full flex items-center justify-center gap-2 mb-4"
        >
          <span>⭐</span>
          <span>Segna momento importante</span>
        </button>

        {/* Session Moments Timeline */}
        <SessionMoments sessionId={sessionId} />

        {/* Meet URL */}
        <div className="bg-bg-tertiary rounded-lg p-3">
          <p className="text-text-muted text-xs mb-1">Meet</p>
          <p className="text-text-secondary text-sm font-mono truncate">{meetUrl}</p>
        </div>
      </div>
    );
  }

  // ── Session ended ───────────────────────────────────────────────────────────
  if (status === 'ended') {
    return (
      <div className="card border border-text-muted/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-text-muted" />
            <span className="text-text-muted font-semibold">Sessione Terminata</span>
          </div>
          <button
            onClick={() => { setSessionId(null); setStatus(null); setMeetUrl(''); }}
            className="btn btn-secondary text-sm"
          >
            Avvia Nuova Sessione
          </button>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-4 text-center">
          <p className="text-text-secondary text-sm">
            La sessione e terminata. Puoi avviarne una nuova quando sei pronto per la prossima.
          </p>
        </div>
      </div>
    );
  }

  // ── Join form (default state) ────────────────────────────────────────────────
  return (
    <div className="card border border-border-primary">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🎙</span>
        <h2 className="text-lg font-semibold text-text-primary">Sessione Meet</h2>
      </div>

      {error && (
        <div className="bg-accent-danger/10 border border-accent-danger text-accent-danger px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-text-secondary text-sm mb-2">
            URL Google Meet
          </label>
          <input
            type="url"
            value={meetUrl}
            onChange={e => setMeetUrl(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            className="input w-full"
          />
        </div>

        <div className="bg-bg-tertiary rounded-lg p-4">
          <p className="text-text-muted text-sm">
            Cliccando <strong>"Entra nel Meet"</strong>, l'app si colleghera al meet
            e iniziera a raccogliere il transcript. I suggerimenti appariranno in tempo reale.
          </p>
        </div>

        <button
          onClick={handleJoin}
          disabled={loading || !meetUrl.trim()}
          className="btn btn-primary w-full"
        >
          {loading ? 'Connessione...' : '▶ Entra nel Meet'}
        </button>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { toast } from './Toast';
import { playSound } from './session/ActiveSession';

export default function SessionRating({ sessionId, onRate }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast('Seleziona un voto da 1 a 5 stelle', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Save rating to DB
      await window.db.sessions.rate({ sessionId, rating, ratingNote: note });
      
      setSubmitted(true);
      toast('Voto salvato!', 'success');
      playSound('success');
      onRate?.({ rating, note });
    } catch (err) {
      console.error('Failed to save rating:', err);
      toast('Errore nel salvataggio del voto', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onRate?.({ rating: 0, note: '' });
  };

  if (submitted) {
    return (
      <div className="card border border-accent-success/30 bg-accent-success/5 p-4 text-center">
        <div className="text-3xl mb-2">⭐</div>
        <h3 className="text-text-primary font-semibold">Grazie per il voto!</h3>
        <p className="text-text-muted text-sm mt-1">Il tuo feedback aiuta a migliorare le sessioni</p>
      </div>
    );
  }

  return (
    <div className="card border border-accent-gold/30 bg-accent-gold/5 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <h3 className="text-text-primary font-semibold">Valuta la Sessione</h3>
        </div>
        <button 
          onClick={handleSkip}
          className="text-text-muted hover:text-text-secondary text-sm"
        >
          Salta
        </button>
      </div>

      <p className="text-text-muted text-sm mb-4">
        Quanto è stata buona questa sessione? Il tuo voto appare sulla dashboard della campagna.
      </p>

      {/* Star rating */}
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className={`
              text-3xl transition-all transform
              ${(hoverRating || rating) >= star 
                ? 'text-accent-gold scale-110' 
                : 'text-text-muted hover:text-accent-gold/50'
              }
              ${rating === star && hoverRating === 0 ? 'scale-125' : ''}
            `}
          >
            ★
          </button>
        ))}
      </div>

      {/* Rating label */}
      <div className="text-center mb-4">
        {rating > 0 && (
          <span className={`
            text-sm font-medium px-3 py-1 rounded-full
            ${rating >= 4 ? 'bg-accent-success/20 text-accent-success' : 
              rating >= 3 ? 'bg-accent-warning/20 text-accent-warning' : 
              'bg-accent-danger/20 text-accent-danger'}
          `}>
            {rating >= 4 ? 'Ottima sessione!' : 
             rating >= 3 ? 'Buona sessione' : 
             rating >= 2 ? 'Sessione ok' : 
             'Potrebbe essere stata meglio'}
          </span>
        )}
      </div>

      {/* Optional note */}
      <div className="mb-4">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Aggiungi una nota (opzionale)..."
          rows={2}
          className="input resize-none text-sm"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="btn btn-primary w-full"
      >
        {submitting ? (
          <>
            <span className="animate-spin mr-1">⟳</span>
            Salvataggio...
          </>
        ) : (
          'Salva Voto'
        )}
      </button>
    </div>
  );
}
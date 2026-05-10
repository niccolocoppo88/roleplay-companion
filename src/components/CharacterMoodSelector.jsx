import React, { useState } from 'react';
import { toast } from './Toast';
import { playSound } from './session/ActiveSession';

const MOOD_OPTIONS = [
  { id: 'happy', emoji: '😊', label: 'Felice', color: 'bg-accent-success/20 border-accent-success/40 text-accent-success' },
  { id: 'neutral', emoji: '😐', label: 'Neutrale', color: 'bg-text-muted/20 border-text-muted/40 text-text-muted' },
  { id: 'angry', emoji: '😠', label: 'Arrabbiato', color: 'bg-accent-danger/20 border-accent-danger/40 text-accent-danger' },
  { id: 'scared', emoji: '😰', label: 'Spaventato', color: 'bg-yellow-600/20 border-yellow-600/40 text-yellow-600' },
];

export default function CharacterMoodSelector({ characterId, currentMood = 'neutral', onMoodChange }) {
  const [mood, setMood] = useState(currentMood);
  const [updating, setUpdating] = useState(false);

  const handleMoodChange = async (newMood) => {
    if (newMood === mood) return;
    
    setUpdating(true);
    try {
      const res = await window.db.characters.update({
        id: characterId,
        mood: newMood,
        mood_updated_at: Date.now(),
      });
      
      if (res.ok) {
        setMood(newMood);
        toast(`Umore cambiato: ${MOOD_OPTIONS.find(m => m.id === newMood)?.emoji}`, 'success');
        playSound('notify');
        onMoodChange?.(newMood);
      }
    } catch (err) {
      console.error('Failed to update mood:', err);
      toast('Errore nell\'aggiornamento dell\'umore', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const activeMood = MOOD_OPTIONS.find(m => m.id === mood) || MOOD_OPTIONS[1];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-muted">Umore:</span>
      <div className="flex gap-1">
        {MOOD_OPTIONS.map(option => (
          <button
            key={option.id}
            onClick={() => handleMoodChange(option.id)}
            disabled={updating}
            className={`
              w-9 h-9 rounded-full border-2 flex items-center justify-center text-xl transition-all
              ${mood === option.id 
                ? `${option.color} scale-110` 
                : 'border-border-primary text-text-muted hover:border-border-hover hover:scale-105'
              }
            `}
            title={option.label}
          >
            {option.emoji}
          </button>
        ))}
      </div>
      
      {/* Current mood label */}
      <span className={`text-xs px-2 py-0.5 rounded-full border ${activeMood.color}`}>
        {activeMood.label}
      </span>
    </div>
  );
}

// Hook to get mood-based AI tone modifier
export function getMoodToneModifier(mood) {
  const modifiers = {
    happy: { temperature: 0.8, prefix: 'enthusiastic', suffix: '' },
    neutral: { temperature: 0.7, prefix: '', suffix: '' },
    angry: { temperature: 0.9, prefix: 'intense', suffix: '' },
    scared: { temperature: 0.5, prefix: 'hesitant', suffix: '' },
  };
  return modifiers[mood] || modifiers.neutral;
}
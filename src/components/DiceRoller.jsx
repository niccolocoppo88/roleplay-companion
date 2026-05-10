import React, { useState, useEffect, useRef } from 'react';
import { toast } from './Toast';
import { playSound } from './session/ActiveSession';

// Parse dice notation like "2d20+5", "1d6", "4d6kh3" (keep highest 3), etc.
function parseDice(notation) {
  const match = notation.toLowerCase().match(/^(\d+)d(\d+)(kh\d+)?(([+-]\d+)*)$/);
  if (!match) return null;
  
  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const keepHigh = match[3] ? parseInt(match[3].replace('kh', '')) : null;
  const modifier = match[4] ? match[4].split(/(?=[+-])/).reduce((s, p) => {
    if (p.startsWith('+')) return s + parseInt(p);
    if (p.startsWith('-')) return s - parseInt(p);
    return s + parseInt(p);
  }, 0) : 0;

  return { numDice, dieSize, keepHigh, modifier };
}

function rollDice(notation) {
  const parsed = parseDice(notation);
  if (!parsed) return null;
  
  const { numDice, dieSize, keepHigh, modifier } = parsed;
  
  // Roll all dice
  let rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * dieSize) + 1);
  }
  
  // Sort for keep highest
  if (keepHigh !== null) {
    rolls.sort((a, b) => b - a);
    rolls = rolls.slice(0, keepHigh);
  }
  
  const total = rolls.reduce((s, r) => s + r, 0) + modifier;
  const breakdown = `(${rolls.join('+')})${modifier >= 0 ? '+' : ''}${modifier || ''}`;
  
  return { result: total, breakdown, rolls, modifier, notation };
}

function rollWithAdvantage(notation) {
  // Roll 2d20 and keep highest
  const r1 = rollDice('1d20');
  const r2 = rollDice('1d20');
  if (!r1 || !r2) return null;
  
  // Use highest result
  const bestRoll = Math.max(r1.result, r2.result);
  const chosen = r1.result >= r2.result ? r1 : r2;
  
  return {
    result: bestRoll,
    breakdown: `2d20: [${r1.rolls[0]}, ${r2.rolls[0]}] → ${bestRoll} (discard ${Math.min(r1.result, r2.result)})`,
    rolls: [r1.rolls[0], r2.rolls[0]],
    modifier: 0,
    notation: '2d20 (adv)',
    advantage: true,
    discarded: Math.min(r1.result, r2.result),
  };
}

function rollWithDisadvantage(notation) {
  // Roll 2d20 and keep lowest
  const r1 = rollDice('1d20');
  const r2 = rollDice('1d20');
  if (!r1 || !r2) return null;
  
  // Use lowest result
  const worstRoll = Math.min(r1.result, r2.result);
  const chosen = r1.result <= r2.result ? r1 : r2;
  
  return {
    result: worstRoll,
    breakdown: `2d20: [${r1.rolls[0]}, ${r2.rolls[0]}] → ${worstRoll} (discard ${Math.max(r1.result, r2.result)})`,
    rolls: [r1.rolls[0], r2.rolls[0]],
    modifier: 0,
    notation: '2d20 (dis)',
    advantage: false,
    discarded: Math.max(r1.result, r2.result),
  };
}

const QUICK_ROLLS = ['1d20', '1d20+5', '2d6', '1d8+3', '1d10', '4d6kh3', '2d10', '1d12'];

export default function DiceRoller({ sessionId = null, characterId = null, onShare = null }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notation, setNotation] = useState('1d20');
  const [rollHistory, setRollHistory] = useState([]);
  const [lastRoll, setLastRoll] = useState(null);
  const [animate, setAnimate] = useState(false);
  const [spinning, setSpinning] = useState(false);

  // Load roll history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await window.db.dice.list();
        if (res.ok) setRollHistory(res.data.slice(0, 20));
      } catch { /* ignore */ }
    }
    loadHistory();
  }, [open]);

  const performRoll = (rollResult, notationOverride = null) => {
    if (!rollResult) return;
    
    const saveData = {
      session_id: sessionId,
      character_id: characterId,
      notation: rollResult.notation,
      result: rollResult.result,
      breakdown: rollResult.breakdown,
    };
    
    // Save to DB
    window.db.dice.create(saveData).then(res => {
      if (res.ok) setRollHistory(prev => [res.data, ...prev.slice(0, 19)]);
    });
    
    setLastRoll(rollResult);
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    setAnimate(true);
    setTimeout(() => setAnimate(false), 500);
    playSound(Math.random() > 0.5 ? 'success' : 'notify');
  };

  async function handleRoll() {
    const result = rollDice(notation);
    if (!result) {
      toast('Formato dado non valido. Es: 2d20+5', 'error');
      return;
    }
    performRoll(result);
  }

  function handleAdvantage() {
    const result = rollWithAdvantage(notation);
    if (!result) {
      toast('Errore nel tiro con vantaggio', 'error');
      return;
    }
    performRoll(result);
  }

  function handleDisadvantage() {
    const result = rollWithDisadvantage(notation);
    if (!result) {
      toast('Errore nel tiro con svantaggio', 'error');
      return;
    }
    performRoll(result);
  }

  function handleQuickRoll(notationToRoll) {
    const result = rollDice(notationToRoll);
    if (!result) return;
    performRoll(result, notationToRoll);
    setNotation(notationToRoll);
  }

  function handleShareRoll() {
    if (!lastRoll || !onShare) return;
    onShare({
      text: `🎲 ${lastRoll.notation} → ${lastRoll.result} ${lastRoll.breakdown}`,
      roll: lastRoll,
    });
    toast('Tiro condiviso!', 'success');
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  return (
    <>
      {/* Floating dice button - always visible */}
      <div className="fixed right-4 z-40 flex flex-col items-end gap-2">
        {/* Dice panel - collapsible */}
        {open && !collapsed && (
          <div className="fixed right-4 bottom-48 z-50 w-72 bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-b border-border-primary">
              <h4 className="font-semibold text-text-primary flex items-center gap-2">
                🎲 Lancia dadi
              </h4>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCollapsed(true)}
                  className="text-text-muted hover:text-text-primary text-sm"
                  title="Minimizza"
                >
                  −
                </button>
                <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
                  ×
                </button>
              </div>
            </div>

            {/* Last roll result */}
            {lastRoll && (
              <div className="px-4 py-3 bg-accent-gold/10 border-b border-border-primary">
                <div className="text-center">
                  <div className={`text-4xl font-bold text-accent-gold transition-all ${animate ? 'scale-125' : 'scale-100'} ${spinning ? 'animate-spin' : ''}`}>
                    {lastRoll.result}
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    {lastRoll.notation}
                  </div>
                  <div className="text-xs text-text-muted font-mono mt-0.5">
                    {lastRoll.breakdown}
                  </div>
                  <div className="flex gap-2 mt-2 justify-center">
                    <button 
                      onClick={() => handleQuickRoll(notation)}
                      className="text-xs text-accent-gold hover:underline"
                    >
                      Rilancia
                    </button>
                    {onShare && (
                      <button 
                        onClick={handleShareRoll}
                        className="text-xs text-accent-primary hover:underline"
                      >
                        Condividi ⬆️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={notation}
                  onChange={e => setNotation(e.target.value.toLowerCase())}
                  placeholder="2d20+5"
                  className="input flex-1 text-center font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleRoll()}
                />
                <button onClick={handleRoll} className="btn btn-primary px-4">
                  🎲
                </button>
              </div>

              {/* Advantage/Disadvantage buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleAdvantage}
                  className="btn btn-secondary text-sm flex items-center justify-center gap-1"
                  title="Tira 2d20 e usa il risultato più alto"
                >
                  <span>⬆️</span>
                  <span>Vantaggio</span>
                </button>
                <button 
                  onClick={handleDisadvantage}
                  className="btn btn-secondary text-sm flex items-center justify-center gap-1"
                  title="Tira 2d20 e usa il risultato più basso"
                >
                  <span>⬇️</span>
                  <span>Svantaggio</span>
                </button>
              </div>

              {/* Quick rolls */}
              <div className="grid grid-cols-4 gap-1">
                {QUICK_ROLLS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuickRoll(q)}
                    className="text-xs py-1.5 px-2 rounded bg-bg-tertiary border border-border-subtle text-text-secondary hover:border-accent-gold hover:text-accent-gold transition-colors font-mono"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* History */}
            {rollHistory.length > 0 && (
              <div className="border-t border-border-primary max-h-40 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-text-muted font-medium">Cronologia</div>
                {rollHistory.map((r, i) => (
                  <div key={r.id || i} className="flex items-center justify-between px-3 py-1.5 hover:bg-bg-tertiary/50">
                    <div>
                      <span className="text-xs text-text-secondary font-mono">{r.notation}</span>
                      <span className="text-xs text-text-muted ml-2">{r.breakdown}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${r.result > 15 ? 'text-accent-success' : r.result < 5 ? 'text-accent-danger' : 'text-text-primary'}`}>
                        {r.result}
                      </span>
                      <span className="text-xs text-text-muted">{formatTime(r.rolled_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed state - mini dice button */}
        {open && collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-14 h-14 rounded-full shadow-lg bg-accent-gold text-bg-primary flex items-center justify-center text-2xl animate-pulse"
            title="Espandi dice roller"
          >
            🎲
          </button>
        )}

        {/* Main floating button */}
        <button
          onClick={() => setOpen(!open)}
          className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300
            ${open 
              ? 'bg-accent-gold text-bg-primary' 
              : 'bg-bg-secondary text-accent-gold border-2 border-accent-gold/50 hover:border-accent-gold hover:scale-110'
            }
            ${animate ? 'animate-bounce' : ''}
          `}
          title="Lancia dadi"
        >
          <span className={spinning ? 'animate-spin' : ''}>🎲</span>
        </button>
      </div>

      {/* Backdrop */}
      {open && !collapsed && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setOpen(false)} 
        />
      )}
    </>
  );
}
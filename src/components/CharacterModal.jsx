import React, { useState, useEffect, useRef } from 'react';
import { toast } from './Toast';
import { playSound } from './session/ActiveSession';

export default function CharacterModal({ mode = 'create', initial = null, campaignId, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [characterClass, setCharacterClass] = useState(initial?.class || '');
  const [race, setRace] = useState(initial?.race || '');
  const [level, setLevel] = useState(initial?.level || 1);
  const [backstory, setBackstory] = useState(initial?.backstory || '');
  const [portrait, setPortrait] = useState(initial?.portrait || '');
  
  // Quick stats
  const [hpCurrent, setHpCurrent] = useState(initial?.hp_current || 0);
  const [hpMax, setHpMax] = useState(initial?.hp_max || 0);
  const [inspiration, setInspiration] = useState(initial?.inspiration || 0);
  const [conditions, setConditions] = useState(initial?.conditions || '[]');

  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef(null);
  const portraitInputRef = useRef(null);

  // D&D Beyond import state
  const [showDnD, setShowDnD] = useState(false);
  const [dnDUrl, setDnDUrl] = useState('');
  const [dnDJson, setDnDJson] = useState('');

  const CONDITIONS_LIST = [
    'Acrobatic', 'Aggressive', 'Blinded', 'Charmed', 'Concentrating',
    'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated',
    'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained',
    'Stunned', 'Unconscious',
  ];

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setCharacterClass(initial.class || '');
      setRace(initial.race || '');
      setLevel(initial.level || 1);
      setBackstory(initial.backstory || '');
      setPortrait(initial.portrait || '');
      setHpCurrent(initial.hp_current || 0);
      setHpMax(initial.hp_max || 0);
      setInspiration(initial.inspiration || 0);
      setConditions(initial.conditions || '[]');
    }
  }, [initial]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function generateWithAI(description) {
    setGenerating(true);
    try {
      const prompt = `Genera un personaggio D&D 5e in italiano basato su questa descrizione: "${description}". Rispondi SOLO con un JSON valido con questa struttura esatta (nessun altro testo):
{
  "name": "nome del personaggio",
  "class": "classe D&D",
  "race": "razza D&D",
  "level": 1-20,
  "backstory": "breve background del personaggio (2-3 frasi)"
}`;

      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=somegroupid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer SOME_API_KEY'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          tokens_to_generate: 500,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      const content = data.choices?.[0]?.messages?.[0]?.text || data.choices?.[0]?.content || '';
      
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      
      const parsed = JSON.parse(jsonStr);
      
      setName(parsed.name || '');
      setCharacterClass(parsed.class || '');
      setRace(parsed.race || '');
      setLevel(parsed.level || 1);
      setBackstory(parsed.backstory || '');
      
      toast('Personaggio generato con successo!', 'success');
    } catch (err) {
      console.error('AI generation error:', err);
      toast('Errore nella generazione AI. Riprova.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  function handleAIGenerate() {
    const description = prompt('Descrivi il tuo personaggio (es: un nano guerriero anziano con una grande barba rossa che ha combattuto draghi)');
    if (description && description.trim()) {
      generateWithAI(description.trim());
    }
  }

  function handlePortraitUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast('Formato non supportato. Usa JPG, PNG o WebP.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast('Immagine troppo grande. Massimo 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPortrait(event.target.result);
      toast('Portrait caricato!', 'success');
    };
    reader.onerror = () => {
      toast('Errore nel caricamento dell\'immagine.', 'error');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removePortrait() {
    setPortrait('');
    toast('Portrait rimosso', 'info');
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        try {
          const parsed = JSON.parse(text);
          if (parsed.name) setName(parsed.name || '');
          if (parsed.class) setCharacterClass(parsed.class || '');
          if (parsed.race) setRace(parsed.race || '');
          if (parsed.level) setLevel(parsed.level || 1);
          if (parsed.backstory) setBackstory(parsed.backstory || '');
          if (parsed.portrait) setPortrait(parsed.portrait || '');
          toast('Personaggio caricato da file!', 'success');
          return;
        } catch {}
        
        const lines = text.split('\n').filter(l => l.trim());
        if (lines[0]) setName(lines[0].trim());
        if (lines[1]) setCharacterClass(lines[1].trim());
        if (lines[2]) setRace(lines[2].trim());
        
        toast('File caricato! Completa i campi mancanti.', 'info');
      } catch (err) {
        toast('Errore nella lettura del file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // D&D Beyond URL parser (mock)
  function handleDnDUrlImport() {
    if (!dnDUrl.trim()) return;
    
    // Parse D&D Beyond URL format: https://www.dndbeyond.com/profile/USERNAME/characters/1234567
    const match = dnDUrl.match(/dndbeyond\.com\/profile\/([^\/]+)\/characters\/(\d+)/i);
    if (match) {
      // Mock character data based on URL
      const mockData = {
        name: `Character ${match[2]}`,
        class: 'Fighter',
        race: 'Human',
        level: 5,
        backstory: `Character imported from D&D Beyond (ID: ${match[2]})`,
      };
      setName(mockData.name);
      setCharacterClass(mockData.class);
      setRace(mockData.race);
      setLevel(mockData.level);
      setBackstory(mockData.backstory);
      setDnDUrl('');
      toast('Personaggio importato da D&D Beyond!', 'success');
    } else {
      toast('URL D&D Beyond non riconosciuto.', 'error');
    }
  }

  // JSON import from D&D Beyond export
  function handleDnDJsonImport() {
    if (!dnDJson.trim()) return;
    
    try {
      const parsed = JSON.parse(dnDJson);
      // D&D Beyond export format
      if (parsed.name) setName(parsed.name);
      if (parsed.class) setCharacterClass(parsed.class?.name || parsed.class);
      if (parsed.race) setRace(parsed.race?.name || parsed.race);
      if (parsed.level) setLevel(parsed.level);
      if (parsed.backstory || parsed.traits?.backstory) {
        setBackstory(parsed.backstory || parsed.traits?.backstory);
      }
      // Try to extract HP from stats
      if (parsed.stats) {
        const hpStat = parsed.stats.find(s => s.id === 1); // HP is usually id 1
        if (hpStat?.value !== undefined) setHpCurrent(hpStat.value);
        if (hpStat?.max !== undefined) setHpMax(hpStat.max);
      }
      setDnDJson('');
      setShowDnD(false);
      toast('Personaggio importato!', 'success');
    } catch {
      toast('JSON non valido. Verifica il formato.', 'error');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      campaign_id: campaignId,
      name: name.trim(),
      class: characterClass.trim(),
      race: race.trim(),
      level: parseInt(level, 10) || 1,
      backstory: backstory.trim(),
      portrait: portrait,
      hp_current: hpCurrent,
      hp_max: hpMax,
      inspiration: inspiration,
      conditions: conditions,
    });
    playSound('success');
  }

  const toggleCondition = (cond) => {
    try {
      const arr = JSON.parse(conditions);
      const idx = arr.indexOf(cond);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(cond);
      setConditions(JSON.stringify(arr));
    } catch { setConditions('[]'); }
  };

  const activeConditions = (() => {
    try { return JSON.parse(conditions); } catch { return []; }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card border-border-primary max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto modal-content">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {mode === 'create' ? 'Nuovo Personaggio' : 'Modifica Personaggio'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Portrait Upload Zone */}
          <div className="flex items-start gap-4">
            <div 
              className="relative cursor-pointer group"
              onClick={() => portraitInputRef.current?.click()}
            >
              {portrait ? (
                <div className="relative">
                  <img 
                    src={portrait} 
                    alt="Portrait" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-border-primary"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs">Modifica</span>
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-bg-tertiary border-2 border-dashed border-border-primary flex items-center justify-center text-2xl text-text-muted hover:border-accent-primary transition-colors">
                  📷
                </div>
              )}
              <input
                ref={portraitInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePortraitUpload}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-text-secondary font-medium">Portrait</p>
              <p className="text-xs text-text-muted">Click per caricare JPG, PNG o WebP (max 2MB)</p>
              {portrait && (
                <button
                  type="button"
                  onClick={removePortrait}
                  className="text-xs text-accent-danger hover:underline mt-1"
                >
                  Rimuovi portrait
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-2">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome del personaggio"
              className="input"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary text-sm mb-2">Classe</label>
              <input
                type="text"
                value={characterClass}
                onChange={e => setCharacterClass(e.target.value)}
                placeholder="Guerriero, Mago..."
                className="input"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-2">Razza</label>
              <input
                type="text"
                value={race}
                onChange={e => setRace(e.target.value)}
                placeholder="Elfo, Nano..."
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="block text-text-secondary text-sm mb-2">Livello</label>
            <input
              type="number"
              value={level}
              onChange={e => setLevel(e.target.value)}
              min="1"
              max="20"
              className="input"
            />
          </div>

          {/* HP Tracker */}
          <div className="border-t border-border-primary pt-3">
            <label className="block text-text-secondary text-sm mb-2">❤️ HP (Current / Max)</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="number"
                  value={hpCurrent}
                  onChange={e => setHpCurrent(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  className="input pr-12"
                  placeholder="Attuale"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">HP</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={hpMax}
                  onChange={e => setHpMax(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  className="input pr-12"
                  placeholder="Massimo"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">Max</span>
              </div>
            </div>
            {/* HP Bar visualization */}
            {hpMax > 0 && (
              <div className="mt-2 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${hpCurrent / hpMax > 0.5 ? 'bg-accent-success' : hpCurrent / hpMax > 0.25 ? 'bg-yellow-600' : 'bg-accent-danger'}`}
                  style={{ width: `${Math.min(100, (hpCurrent / hpMax) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Inspiration */}
          <div className="flex items-center gap-3">
            <label className="text-text-secondary text-sm">✨ Ispirazione:</label>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInspiration(n === inspiration ? 0 : n)}
                  className={`w-7 h-7 rounded-full border text-xs font-bold transition-all ${
                    n <= inspiration 
                      ? 'bg-accent-gold border-accent-gold text-bg-primary' 
                      : 'border-border-primary text-text-muted hover:border-accent-gold'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-text-secondary text-sm mb-2">⚠️ Condizioni</label>
            <div className="flex flex-wrap gap-1">
              {CONDITIONS_LIST.slice(0, 9).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCondition(c)}
                  className={`text-xs px-2 py-1 rounded-full border transition-all ${
                    activeConditions.includes(c)
                      ? 'bg-accent-danger/20 border-accent-danger text-accent-danger'
                      : 'border-border-primary text-text-muted hover:border-accent-danger'
                  }`}
                >
                  {c}
                </button>
              ))}
              {activeConditions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConditions('[]')}
                  className="text-xs px-2 py-1 rounded-full border border-text-muted text-text-muted hover:border-accent-danger"
                >
                  ✕ clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-2">Background</label>
            <textarea
              value={backstory}
              onChange={e => setBackstory(e.target.value)}
              placeholder="Storia del personaggio..."
              rows={3}
              className="input resize-none"
            />
          </div>
          
          {/* D&D Beyond Import Toggle */}
          <div className="border-t border-border-primary pt-3">
            <button
              type="button"
              onClick={() => setShowDnD(!showDnD)}
              className="text-sm text-accent-primary hover:underline flex items-center gap-1"
            >
              🎲 {showDnD ? 'Nascondi' : 'Importa da D&D Beyond'}
            </button>
            
            {showDnD && (
              <div className="mt-3 space-y-3 p-3 bg-bg-tertiary rounded-lg border border-border-subtle">
                <div>
                  <label className="block text-text-muted text-xs mb-1">Paste D&D Beyond URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={dnDUrl}
                      onChange={e => setDnDUrl(e.target.value)}
                      placeholder="https://www.dndbeyond.com/profile/..."
                      className="input text-sm flex-1"
                    />
                    <button type="button" onClick={handleDnDUrlImport} className="btn btn-secondary text-sm">
                      Import
                    </button>
                  </div>
                </div>
                <div className="text-center text-text-muted text-xs">— oppure —</div>
                <div>
                  <label className="block text-text-muted text-xs mb-1">Paste JSON da export D&D Beyond</label>
                  <textarea
                    value={dnDJson}
                    onChange={e => setDnDJson(e.target.value)}
                    placeholder='{"name": "...", "class": {...}, ...}'
                    rows={3}
                    className="input text-xs resize-none font-mono"
                  />
                  <button type="button" onClick={handleDnDJsonImport} className="btn btn-secondary text-sm mt-2 w-full">
                    Importa JSON
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* AI Generate & File Upload buttons */}
          <div className="flex gap-2 pt-2 border-t border-border-primary">
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={generating}
              className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Genera con AI</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary flex items-center justify-center gap-2"
              title="Carica da file"
            >
              <span>📁</span>
              <span>File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Annulla</button>
            <button type="submit" disabled={!name.trim()} className="btn btn-primary">
              {mode === 'create' ? 'Crea' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
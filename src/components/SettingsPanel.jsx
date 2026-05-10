import React, { useState, useEffect } from 'react';
import { toast } from './Toast';
import { playSound } from './session/ActiveSession';

const THEMES = [
  { id: 'dark', label: 'Scuro', icon: '🌙' },
  { id: 'system', label: 'Sistema', icon: '💻' },
];

const CREATIVITY_LEVELS = [
  { value: 0.3, label: 'Focale', description: 'Risposte concentrate e precise' },
  { value: 0.5, label: 'Bilanciato', description: 'Equilibrio tra precisione e creatività' },
  { value: 0.7, label: 'Creativo', description: 'Risposte più elaborate e inventive' },
  { value: 0.9, label: 'Espansivo', description: 'Massima creatività e sorprese' },
];

export default function SettingsPanel({ onClose }) {
  const [theme, setTheme] = useState('dark');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [creativityLevel, setCreativityLevel] = useState(0.7);
  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetUrl, setNewPresetUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Load settings from DB
  useEffect(() => {
    async function loadSettings() {
      try {
        const [
          themeRes, 
          soundRes, 
          tempRes, 
          creativityRes,
          presetsRes
        ] = await Promise.all([
          window.db.settings.get('theme'),
          window.db.settings.get('sound_enabled'),
          window.db.settings.get('temperature'),
          window.db.settings.get('creativity_level'),
          window.db.presets.list(),
        ]);

        if (themeRes.ok && themeRes.data) setTheme(themeRes.data);
        if (soundRes.ok && soundRes.data !== null) setSoundEnabled(soundRes.data === 'true');
        if (tempRes.ok && tempRes.data) setTemperature(parseFloat(tempRes.data));
        if (creativityRes.ok && creativityRes.data) setCreativityLevel(parseFloat(creativityRes.data));
        if (presetsRes.ok) setPresets(presetsRes.data || []);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const saveSetting = async (key, value) => {
    try {
      await window.db.settings.set(key, String(value));
    } catch (err) {
      console.error('Failed to save setting:', key, err);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    saveSetting('theme', newTheme);
    applyTheme(newTheme);
    playSound('notify');
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    saveSetting('sound_enabled', newValue);
    playSound('notify');
  };

  const handleTemperatureChange = (val) => {
    setTemperature(val);
    setCreativityLevel(val);
    saveSetting('temperature', val);
    saveSetting('creativity_level', val);
  };

  const handleAddPreset = async () => {
    if (!newPresetName.trim() || !newPresetUrl.trim()) {
      toast('Inserisci nome e URL per il preset', 'error');
      return;
    }
    
    try {
      const res = await window.db.presets.create({
        name: newPresetName.trim(),
        url: newPresetUrl.trim(),
      });
      if (res.ok) {
        setPresets(prev => [res.data, ...prev]);
        setNewPresetName('');
        setNewPresetUrl('');
        toast('Preset aggiunto!', 'success');
        playSound('success');
      }
    } catch (err) {
      toast('Errore nell\'aggiunta del preset', 'error');
    }
  };

  const handleDeletePreset = async (id) => {
    try {
      await window.db.presets.delete(id);
      setPresets(prev => prev.filter(p => p.id !== id));
      toast('Preset rimosso', 'info');
    } catch (err) {
      toast('Errore nella rimozione', 'error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative card border-border-primary max-w-lg w-full mx-4 p-6 modal-content">
          <div className="text-center py-8 text-text-muted">Caricamento impostazioni...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card border-border-primary max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto modal-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <h2 className="text-xl font-bold text-text-primary">Impostazioni</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl">×</button>
        </div>

        <div className="space-y-6">
          {/* Theme Toggle */}
          <div className="card bg-bg-tertiary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">🎨 Tema</h3>
            <div className="flex gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  className={`
                    flex-1 py-3 px-4 rounded-lg border-2 transition-all flex flex-col items-center gap-1
                    ${theme === t.id 
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' 
                      : 'border-border-primary text-text-muted hover:border-border-hover'
                    }
                  `}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound Effects */}
          <div className="card bg-bg-tertiary p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">🔔 Effetti Sonori</h3>
                <p className="text-xs text-text-muted mt-1">Suoni per tiri dadi e notifiche</p>
              </div>
              <button
                onClick={handleSoundToggle}
                className={`
                  w-14 h-8 rounded-full transition-all relative
                  ${soundEnabled ? 'bg-accent-success' : 'bg-bg-secondary border border-border-primary'}
                `}
              >
                <div className={`
                  absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all
                  ${soundEnabled ? 'left-7' : 'left-1'}
                `} />
              </button>
            </div>
          </div>

          {/* AI Settings */}
          <div className="card bg-bg-tertiary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">🤖 Generazione AI</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-text-secondary">Temperatura / Creatività</label>
                  <span className="text-xs text-accent-primary font-medium">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={temperature}
                  onChange={e => handleTemperatureChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-bg-secondary rounded-full appearance-none cursor-pointer accent-accent-primary"
                />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>Focale</span>
                  <span>Espansivo</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CREATIVITY_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => handleTemperatureChange(level.value)}
                    className={`
                      p-3 rounded-lg border text-left transition-all
                      ${Math.abs(temperature - level.value) < 0.05
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                        : 'border-border-primary text-text-muted hover:border-border-hover'
                      }
                    `}
                  >
                    <div className="text-sm font-medium">{level.label}</div>
                    <div className="text-xs opacity-70">{level.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Meet URL Presets */}
          <div className="card bg-bg-tertiary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">🔗 Preset Meet</h3>
            <p className="text-xs text-text-muted mb-4">Salva i tuoi URL Meet comuni per un accesso rapido</p>
            
            {/* Add new preset */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="Nome (es: Campagna Principale)"
                className="input flex-1 text-sm"
              />
              <input
                type="url"
                value={newPresetUrl}
                onChange={e => setNewPresetUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="input flex-[2] text-sm"
              />
              <button onClick={handleAddPreset} className="btn btn-primary text-sm px-3">
                +
              </button>
            </div>

            {/* Preset list */}
            {presets.length > 0 ? (
              <div className="space-y-2">
                {presets.map(preset => (
                  <div 
                    key={preset.id}
                    className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg border border-border-primary"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{preset.name}</div>
                      <div className="text-xs text-text-muted truncate font-mono">{preset.url}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(preset.url);
                          toast('URL copiato!', 'success');
                        }}
                        className="text-text-muted hover:text-accent-primary text-xs px-2 py-1 border border-border-primary rounded hover:border-accent-primary"
                        title="Copia URL"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-text-muted hover:text-accent-danger text-xs px-2 py-1 border border-border-primary rounded hover:border-accent-danger"
                        title="Rimuovi"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-text-muted text-sm">
                <span className="text-2xl">🔗</span>
                <p className="mt-2">Nessun preset salvato</p>
                <p className="text-xs mt-1">Aggiungi i tuoi URL Meet preferiti qui</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border-primary flex justify-end">
          <button onClick={onClose} className="btn btn-primary">
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}

function applyTheme(theme) {
  // Theme is always dark for now - this is a placeholder for future light mode
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
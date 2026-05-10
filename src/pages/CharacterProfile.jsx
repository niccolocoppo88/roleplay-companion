import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MOCK_CHARACTERS } from '../data/mockData';
import StatsTab from '../components/profile/StatsTab';
import InventoryTab from '../components/profile/InventoryTab';
import BiographyTab from '../components/profile/BiographyTab';
import NotesTab from '../components/profile/NotesTab';
import TimelineTab from '../components/profile/TimelineTab';
import MotivationsTab from '../components/profile/MotivationsTab';
import DreamsTab from '../components/profile/DreamsTab';
import FearsTab from '../components/profile/FearsTab';
import ConsistencyTab from '../components/profile/ConsistencyTab';
import CharacterMoodSelector from '../components/CharacterMoodSelector';
import { toast } from '../components/Toast';
import { playSound } from '../components/session/ActiveSession';

const TABS = [
  { id: 'stats', label: 'Scheda', icon: '📋' },
  { id: 'storyarc', label: 'Arco', icon: '📜' },
  { id: 'relationships', label: 'Relazioni', icon: '🤝' },
  { id: 'secrets', label: 'Segreti', icon: '🔮' },
  { id: 'inventory', label: 'Inventario', icon: '🎒' },
  { id: 'biography', label: 'Biografia', icon: '📖' },
  { id: 'notes', label: 'Note', icon: '📝' },
  { id: 'timeline', label: 'Timeline', icon: '⏳' },
  { id: 'motivations', label: 'Motivi', icon: '🎯' },
  { id: 'dreams', label: 'Sogni', icon: '✨' },
  { id: 'fears', label: 'Paure', icon: '😨' },
  { id: 'consistency', label: 'Check', icon: '🔍' },
];

export default function CharacterProfile() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingType, setGeneratingType] = useState(null); // 'backstory' | 'catchphrase' | 'adventure'

  // Load character from DB or use mock
  useEffect(() => {
    async function load() {
      try {
        if (window.db?.characters) {
          const res = await window.db.characters.get(characterId);
          if (res.ok && res.data) {
            setCharacter(res.data);
          } else {
            // Fallback to mock
            setCharacter(MOCK_CHARACTERS.find(c => c.id === characterId) || MOCK_CHARACTERS[0]);
          }
        } else {
          setCharacter(MOCK_CHARACTERS.find(c => c.id === characterId) || MOCK_CHARACTERS[0]);
        }
      } catch (err) {
        setCharacter(MOCK_CHARACTERS.find(c => c.id === characterId) || MOCK_CHARACTERS[0]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [characterId]);

  // Handle escape key to go back
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        navigate(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  /**
   * Generate backstory using MiniMax API
   */
  async function generateBackstory() {
    if (!character) return;
    setGeneratingType('backstory');
    try {
      const prompt = `Genera un background dettagliato per un personaggio D&D 5e italiano.
Nome: ${character.name}
Razza: ${character.race}
Classe: ${character.class}
Livello: ${character.level}

Il background deve essere ricco di dettagli sulla storia del personaggio, includendo:
- Origini e luogo di nascita
- Eventi formativi chiave
- Motivazioni principali
- Un legame specifico con il mondo di gioco

Rispondi SOLO con un JSON valido con questa struttura (nessun altro testo):
{
  "backstory": "il background completo in italiano (3-4 paragrafi)",
  "personalityTraits": "tratti di personalità (1-2 frasi)",
  "ideals": "ideali del personaggio (1-2 frasi)",
  "bonds": "legami del personaggio (1-2 frasi)",
  "flaws": "difetti del personaggio (1-2 frasi)"
}`;

      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=somegroupid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer SOME_API_KEY'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          tokens_to_generate: 800,
          temperature: 0.8,
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
      
      // Update character with generated backstory
      const updatedChar = { 
        ...character, 
        backstory: parsed.backstory || character.backstory,
        biography: {
          ...character.biography,
          personalityTraits: parsed.personalityTraits || character.biography?.personalityTraits,
          ideals: parsed.ideals || character.biography?.ideals,
          bonds: parsed.bonds || character.biography?.bonds,
          flaws: parsed.flaws || character.biography?.flaws,
        }
      };
      setCharacter(updatedChar);
      
      // Save to DB if available
      if (window.db?.characters?.update) {
        await window.db.characters.update({ id: character.id, backstory: parsed.backstory });
      }
      
      toast('Background generato con successo!', 'success');
      playSound('success');
    } catch (err) {
      console.error('Backstory generation error:', err);
      toast('Errore nella generazione del background. Riprova.', 'error');
    } finally {
      setGeneratingType(null);
    }
  }

  /**
   * Generate catchphrase using MiniMax API
   */
  async function generateCatchphrase() {
    if (!character) return;
    setGeneratingType('catchphrase');
    try {
      const prompt = `Genera una catchphrase iconica per un personaggio D&D 5e italiano.
Nome: ${character.name}
Razza: ${character.race}
Classe: ${character.class}
Personalità: ${character.biography?.personalityTraits || 'Non definita'}
Background: ${character.backstory || 'Non definito'}

La catchphrase deve essere breve (1-2 frasi), evocativa e rappresentare la personalità o il motto del personaggio.
Deve essere in italiano e avere un tono epico o significativo.

Rispondi SOLO con un JSON valido (nessun altro testo):
{
  "catchphrase": "la catchphrase in italiano (1-2 frasi)"
}`;

      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=somegroupid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer SOME_API_KEY'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          tokens_to_generate: 200,
          temperature: 0.9,
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
      
      // Update character with catchphrase
      const updatedChar = { ...character, catchphrase: parsed.catchphrase };
      setCharacter(updatedChar);
      
      // Save to DB if available
      if (window.db?.characters?.update) {
        await window.db.characters.update({ id: character.id, catchphrase: parsed.catchphrase });
      }
      
      toast('Catchphrase generata!', 'success');
    } catch (err) {
      console.error('Catchphrase generation error:', err);
      toast('Errore nella generazione della catchphrase. Riprova.', 'error');
    } finally {
      setGeneratingType(null);
    }
  }

  /**
   * Suggest next adventure/quest based on character goals
   */
  async function suggestNextAdventure() {
    if (!character) return;
    setGeneratingType('adventure');
    try {
      const prompt = `Basandoti sui seguenti obiettivi e background del personaggio, suggerisci una prossima avventura/quest per una campagna D&D 5e.

Personaggio: ${character.name}
Razza: ${character.race}
Classe: ${character.class}
Livello: ${character.level}
Background: ${character.backstory || 'Non definito'}
Motivazione principale: ${character.motivations?.primary || 'Non definita'}
Sogni: ${character.dreams?.longTerm || 'Non definiti'}

La quest deve essere appropriata per il livello del personaggio e deve presentare:
- Una situazione iniziale
- Un obiettivo chiaro
- Un antagonista o ostacolo principale
- Un potential twist interessante

Rispondi SOLO con un JSON valido (nessun altro testo):
{
  "title": "titolo della quest",
  "description": "descrizione dettagliata della quest (2-3 paragrafi)",
  "objectives": ["obiettivo 1", "obiettivo 2", "obiettivo 3"],
  "potentialTwist": "un possibile colpo di scena"
}`;

      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=somegroupid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer SOME_API_KEY'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          tokens_to_generate: 600,
          temperature: 0.8,
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
      
      // Show adventure suggestion to user (could be stored in notes)
      const adventureNote = `[Quest Suggerita] ${parsed.title}\n\n${parsed.description}\n\nObiettivi: ${parsed.objectives?.join(', ')}\n\nTwist: ${parsed.potentialTwist}`;
      
      const updatedChar = { 
        ...character, 
        suggestedAdventure: parsed,
        notes: [...(character.notes || []), { 
          id: `note-${Date.now()}`, 
          date: new Date().toISOString().split('T')[0], 
          category: 'adventure', 
          content: adventureNote 
        }]
      };
      setCharacter(updatedChar);
      
      toast('Avventura suggerita! Controlla le note.', 'success');
    } catch (err) {
      console.error('Adventure suggestion error:', err);
      toast('Errore nella generazione dell\'avventura. Riprova.', 'error');
    } finally {
      setGeneratingType(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <div className="flex items-center justify-center flex-1">
          <p className="text-text-secondary">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary">
        <div className="flex items-center justify-center flex-1">
          <p className="text-text-secondary">Personaggio non trovato</p>
        </div>
      </div>
    );
  }

  const xpPercent = Math.round((character.xp / character.maxXp) * 100);

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center gap-3 text-sm text-text-muted mb-2">
          <Link to="/" className="hover:text-accent-primary transition-colors">Campagne</Link>
          <span>/</span>
          <span className="text-text-secondary">{character.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Portrait or Avatar placeholder */}
            {character.portrait ? (
              <img 
                src={character.portrait} 
                alt={character.name} 
                className="w-16 h-16 rounded-full object-cover border-2 border-border-primary"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-bg-tertiary border-2 border-border-primary flex items-center justify-center text-2xl">
                ⚔️
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{character.name}</h1>
              <p className="text-text-secondary">
                {character.race} {character.class} • Livello {character.level}
              </p>
              {character.catchphrase && (
                <p className="text-text-muted text-sm italic mt-1">"{character.catchphrase}"</p>
              )}
              {/* Mood Selector */}
              <div className="mt-2">
                <CharacterMoodSelector 
                  characterId={character.id}
                  currentMood={character.mood || 'neutral'}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* AI Generation Buttons */}
            <div className="flex items-center gap-2 mr-4">
              <button
                onClick={generateBackstory}
                disabled={generatingType !== null}
                className="btn btn-secondary text-xs flex items-center gap-1"
                title="Genera background con AI"
              >
                {generatingType === 'backstory' ? (
                  <span className="animate-spin">⟳</span>
                ) : (
                  <span>📖</span>
                )}
                <span>Genera Background</span>
              </button>
              <button
                onClick={generateCatchphrase}
                disabled={generatingType !== null}
                className="btn btn-secondary text-xs flex items-center gap-1"
                title="Genera catchphrase con AI"
              >
                {generatingType === 'catchphrase' ? (
                  <span className="animate-spin">⟳</span>
                ) : (
                  <span>💬</span>
                )}
                <span>Genera Catchphrase</span>
              </button>
              <button
                onClick={suggestNextAdventure}
                disabled={generatingType !== null}
                className="btn btn-secondary text-xs flex items-center gap-1"
                title="Suggerisci prossima avventura"
              >
                {generatingType === 'adventure' ? (
                  <span className="animate-spin">⟳</span>
                ) : (
                  <span>🗺</span>
                )}
                <span>Suggerisci Avventura</span>
              </button>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="btn btn-secondary text-sm"
            >
              ← Indietro
            </button>
            <button className="btn btn-primary text-sm">
              Modifica
            </button>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span>Esperienza</span>
            <span>{character.xp} / {character.maxXp} XP ({xpPercent}%)</span>
          </div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div className="bg-bg-secondary border-b border-border-primary px-6 py-2">
        <div className="flex items-center gap-6 text-sm">
          <QuickStat label="CA" value={character.armorClass} />
          <QuickStat label="PF" value={`${character.hitPoints.current}/${character.hitPoints.max}`} highlight />
          <QuickStat label="Velocità" value={`${character.speed} ft`} />
          <QuickStat label="Bonus Prof." value={`+${character.proficiencyBonus}`} />
          <QuickStat label="Allineamento" value={character.alignment} />
          <QuickStat label="Background" value={character.background} />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-bg-secondary border-b border-border-primary px-6">
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab.id
                  ? 'text-accent-primary border-accent-primary'
                  : 'text-text-muted border-transparent hover:text-text-secondary hover:border-border-hover'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'stats' && <StatsTab character={character} />}
        {activeTab === 'storyarc' && (
          <div className="p-6">
            <div className="card-gradient p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">📜</span>
                <h2 className="text-xl font-semibold text-text-primary">Arco Narrativo</h2>
              </div>
              <p className="text-text-secondary whitespace-pre-wrap leading-relaxed">
                {character.storyArc || 'L\'arco narrativo del personaggio descrive il suo viaggio attraverso la storia — le sfide che affronta, le trasformazioni che subisce e il destino che cerca di raggiungere. Questa sezione si svilupperà man mano che il personaggio partecipa a nuove avventure.'}
              </p>
              <div className="mt-4 pt-4 border-t border-border-primary">
                <p className="text-text-muted text-xs">L'arco narrativo viene aggiornato automaticamente basandosi sugli eventi delle sessioni.</p>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'relationships' && (
          <div className="p-6">
            <div className="card-gradient p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🤝</span>
                <h2 className="text-xl font-semibold text-text-primary">Relazioni</h2>
              </div>
              <div className="space-y-4">
                {character.relationships && character.relationships.length > 0 ? (
                  character.relationships.map((rel, idx) => (
                    <div key={idx} className="bg-bg-tertiary rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-text-primary font-medium">{rel.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rel.type === 'ally' ? 'bg-accent-success/20 text-accent-success' :
                          rel.type === 'enemy' ? 'bg-accent-danger/20 text-accent-danger' :
                          'bg-accent-primary/20 text-accent-primary'
                        }`}>{rel.type}</span>
                      </div>
                      <p className="text-text-secondary text-sm">{rel.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl">🤝</span>
                    <p className="text-text-muted mt-2">Nessuna relazione definita</p>
                    <p className="text-text-muted text-xs mt-1">Le relazioni con NPC verranno aggiunte automaticamente durante le sessioni</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'secrets' && (
          <div className="p-6">
            <div className="card-gradient p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔮</span>
                <h2 className="text-xl font-semibold text-text-primary">Segreti</h2>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-4 mb-4">
                <p className="text-text-muted text-xs mb-2">⚠️ Solo tu puoi vedere questa sezione</p>
                <p className="text-text-secondary text-sm">I segreti del personaggio — informazioni nascoste che solo il giocatore conosce e che possono essere rivelate durante il gioco.</p>
              </div>
              <div className="space-y-3">
                {character.secrets && character.secrets.length > 0 ? (
                  character.secrets.map((secret, idx) => (
                    <div key={idx} className="bg-bg-tertiary/50 border border-border-primary rounded-lg p-4">
                      <p className="text-text-primary">{secret}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl">🔮</span>
                    <p className="text-text-muted mt-2">Nessun segreto definito</p>
                    <p className="text-text-muted text-xs mt-1">Aggiungi i segreti del tuo personaggio per tenere traccia delle informazioni nascoste</p>
                  </div>
                )}
              </div>
              {/* Quote field */}
              {character.quote && (
                <div className="mt-6 pt-4 border-t border-border-primary">
                  <h3 className="text-text-primary font-medium mb-2">💬 Citazione Iconica</h3>
                  <blockquote className="text-text-secondary italic border-l-2 border-accent-primary pl-4">
                    "{character.quote}"
                  </blockquote>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'inventory' && <InventoryTab inventory={character.inventory} />}
        {activeTab === 'biography' && <BiographyTab biography={character.biography} />}
        {activeTab === 'motivations' && <MotivationsTab motivations={character.motivations} />}
        {activeTab === 'notes' && <NotesTab notes={character.notes} />}
        {activeTab === 'timeline' && <TimelineTab timeline={character.timeline} />}
        {activeTab === 'dreams' && <DreamsTab dreams={character.dreams} />}
        {activeTab === 'fears' && <FearsTab fears={character.fears} />}
        {activeTab === 'consistency' && <ConsistencyTab character={character} />}
      </main>
    </div>
  );
}

function QuickStat({ label, value, highlight }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-text-muted text-xs uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-accent-success' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}
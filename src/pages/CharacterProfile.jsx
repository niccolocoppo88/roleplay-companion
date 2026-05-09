import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MOCK_CHARACTERS } from '../data/mockData';
import StatsTab from '../components/profile/StatsTab';
import InventoryTab from '../components/profile/InventoryTab';
import BiographyTab from '../components/profile/BiographyTab';
import NotesTab from '../components/profile/NotesTab';
import TimelineTab from '../components/profile/TimelineTab';

const TABS = [
  { id: 'stats', label: 'Scheda', icon: '📋' },
  { id: 'inventory', label: 'Inventario', icon: '🎒' },
  { id: 'biography', label: 'Biografia', icon: '📖' },
  { id: 'notes', label: 'Note', icon: '📝' },
  { id: 'timeline', label: 'Timeline', icon: '⏳' },
];

export default function CharacterProfile() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');

  const character = MOCK_CHARACTERS.find(c => c.id === characterId) || MOCK_CHARACTERS[0];

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
            {/* Avatar placeholder */}
            <div className="w-16 h-16 rounded-full bg-bg-tertiary border-2 border-border-primary flex items-center justify-center text-2xl">
              ⚔️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{character.name}</h1>
              <p className="text-text-secondary">
                {character.race} {character.class} • Livello {character.level}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
        {activeTab === 'inventory' && <InventoryTab inventory={character.inventory} />}
        {activeTab === 'biography' && <BiographyTab biography={character.biography} />}
        {activeTab === 'notes' && <NotesTab notes={character.notes} />}
        {activeTab === 'timeline' && <TimelineTab timeline={character.timeline} />}
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

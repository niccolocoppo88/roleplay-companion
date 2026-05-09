import React from 'react';

const STAT_LABELS = {
  strength: 'For',
  dexterity: 'Des',
  constitution: 'Cos',
  intelligence: 'Int',
  wisdom: 'Sag',
  charisma: 'Car',
};

const SKILL_MAP = {
  strength: ['Atletica'],
  dexterity: ['Acrobazia', 'Furtività', 'Rapidità di mano'],
  constitution: [],
  intelligence: ['Arcano', 'Storia', 'Investigazione', 'Natura', 'Religione'],
  wisdom: ['Animali', 'Intuizione', 'Medicina', 'Percezione', 'Sopravvivenza'],
  charisma: ['Inganno', 'Intimidazione', 'Intrattenimento', 'Persuasione'],
};

export default function StatsTab({ character }) {
  const { stats, savingThrows, skills, spellcasting } = character;

  return (
    <div className="p-6 grid grid-cols-12 gap-6">
      {/* Left column: Stats + Saving throws */}
      <div className="col-span-3 space-y-6">
        {/* Stats block */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Caratteristiche</h3>
          <div className="space-y-3">
            {Object.entries(stats).map(([stat, value]) => {
              const mod = Math.floor((value - 10) / 2);
              const sign = mod >= 0 ? '+' : '';
              return (
                <div key={stat} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-accent-primary w-6">{STAT_LABELS[stat]}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-10 h-10 rounded bg-bg-tertiary border border-border-primary flex items-center justify-center">
                      <span className="text-sm font-bold text-text-primary">{value}</span>
                    </div>
                    <span className={`text-sm font-medium ${mod >= 0 ? 'text-accent-success' : 'text-text-muted'}`}>
                      {sign}{mod}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Saving throws */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Tiri Salvezza</h3>
          <div className="space-y-1">
            {savingThrows.map((st, i) => {
              const mod = Math.floor((stats[st.stat] - 10) / 2);
              const sign = mod >= 0 ? '+' : '';
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-4 text-center ${st.proficient ? 'text-accent-primary' : 'text-text-muted'}`}>
                    {st.proficient ? '●' : '○'}
                  </span>
                  <span className="text-text-secondary w-6">{STAT_LABELS[st.stat]}</span>
                  <span className="text-text-primary font-medium">{sign}{st.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Middle column: Combat stats + Skills */}
      <div className="col-span-5 space-y-6">
        {/* Combat stats */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Combat</h3>
          <div className="grid grid-cols-4 gap-4">
            <CombatStat label="CA" value={character.armorClass} />
            <CombatStat label="Initiativa" value={`+${Math.floor((stats.dexterity - 10) / 2)}`} />
            <CombatStat label="Velocità" value={`${character.speed} ft`} />
            <CombatStat label="Temp PF" value={character.hitPoints.temp || '—'} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="bg-bg-tertiary rounded p-3 text-center">
              <div className="text-xs text-text-muted mb-1">PF Correnti</div>
              <div className="text-lg font-bold text-accent-success">
                {character.hitPoints.current}
              </div>
              <div className="text-xs text-text-muted">/ {character.hitPoints.max} max</div>
            </div>
            <div className="bg-bg-tertiary rounded p-3 text-center">
              <div className="text-xs text-text-muted mb-1">CD Tiro Salvezza</div>
              <div className="text-lg font-bold text-accent-primary">
                {spellcasting.saveDC}
              </div>
              <div className="text-xs text-text-muted">{spellcasting.class} ({spellcasting.ability.toUpperCase()})</div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Abilità</h3>
          <div className="grid grid-cols-2 gap-1">
            {skills.map((skill, i) => {
              const statMod = Math.floor((stats[skill.stat] - 10) / 2);
              const sign = skill.value >= 0 ? '+' : '';
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className={`w-4 text-center text-xs ${skill.proficient ? 'text-accent-primary' : 'text-text-muted'}`}>
                    {skill.proficient ? '●' : '○'}
                  </span>
                  <span className="text-text-muted text-xs w-16">{skill.name}</span>
                  <span className="text-text-secondary text-xs">{STAT_LABELS[skill.stat]}</span>
                  <span className={`text-sm font-medium ml-auto ${skill.value >= 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                    {sign}{skill.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right column: Features + Spellcasting */}
      <div className="col-span-4 space-y-6">
        {/* Features/Traits */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Tratti & Poteri</h3>
          <div className="space-y-3">
            {character.features.map((feat, i) => (
              <div key={i} className="border-l-2 border-accent-primary pl-3">
                <div className="text-sm font-medium text-text-primary">{feat.name}</div>
                <div className="text-xs text-text-muted mb-1">{feat.source}</div>
                <div className="text-sm text-text-secondary">{feat.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Spellcasting */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Incantesimi ({spellcasting.class})
          </h3>
          <div className="space-y-3">
            {spellcasting.spells.map((spellLevel, i) => (
              <div key={i}>
                <div className="text-xs text-text-muted mb-1 uppercase tracking-wide">
                  Livello {spellLevel.level === 0 ? 'Cantrips' : spellLevel.level}
                  {spellLevel.slots > 0 && (
                    <span className="text-accent-primary ml-1">({spellLevel.used}/{spellLevel.slots} slots)</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {spellLevel.prepared.map((spell, j) => (
                    <span
                      key={j}
                      className="text-xs px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-secondary"
                    >
                      {spell}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CombatStat({ label, value }) {
  return (
    <div className="bg-bg-tertiary rounded p-3 text-center">
      <div className="text-xs text-text-muted mb-1 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
    </div>
  );
}
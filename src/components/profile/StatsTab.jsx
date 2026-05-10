import React, { useState } from 'react';

const STAT_LABELS = {
  strength: 'For',
  dexterity: 'Des',
  constitution: 'Cos',
  intelligence: 'Int',
  wisdom: 'Sag',
  charisma: 'Car',
};

const STAT_FULL_NAMES = {
  strength: 'Forza',
  dexterity: 'Destrezza',
  constitution: 'Costituzione',
  intelligence: 'Intelligenza',
  wisdom: 'Sagezza',
  charisma: 'Carisma',
};

const SKILL_MAP = {
  strength: ['Atletica'],
  dexterity: ['Acrobazia', 'Furtività', 'Rapidità di mano'],
  constitution: [],
  intelligence: ['Arcano', 'Storia', 'Investigazione', 'Natura', 'Religione'],
  wisdom: ['Animali', 'Intuizione', 'Medicina', 'Percezione', 'Sopravvivenza'],
  charisma: ['Inganno', 'Intimidazione', 'Intrattenimento', 'Persuasione'],
};

/**
 * Calculate D&D 5e ability score modifier
 */
function getModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod;
}

/**
 * Format modifier with sign
 */
function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Roll a d20
 */
function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Roll ability check (d20 + modifier)
 */
function rollAbilityCheck(score, proficiency = 0, proficiencyBonus = 0) {
  const d20 = rollD20();
  const mod = getModifier(score);
  const total = d20 + mod + (proficiency ? proficiencyBonus : 0);
  return { d20, mod, proficiencyBonus: proficiency ? proficiencyBonus : 0, total };
}

export default function StatsTab({ character }) {
  const { stats, savingThrows, skills, spellcasting } = character;
  const [rollResult, setRollResult] = useState(null);
  const [rollingStat, setRollingStat] = useState(null);

  /**
   * Handle clicking on an ability score to roll
   */
  function handleRollStat(stat) {
    setRollingStat(stat);
    const result = rollAbilityCheck(stats[stat], false, 0);
    setRollResult(result);
    
    // Clear result after 3 seconds
    setTimeout(() => {
      setRollResult(null);
      setRollingStat(null);
    }, 3000);
  }

  /**
   * Handle rolling a saving throw
   */
  function handleRollSavingThrow(st) {
    const result = rollAbilityCheck(stats[st.stat], st.proficient, character.proficiencyBonus);
    setRollResult({ ...result, type: 'saving', stat: st.stat });
    
    setTimeout(() => {
      setRollResult(null);
    }, 3000);
  }

  /**
   * Handle rolling a skill check
   */
  function handleRollSkill(skill) {
    const statMod = getModifier(stats[skill.stat]);
    const prof = skill.proficient ? character.proficiencyBonus : 0;
    const d20 = rollD20();
    const total = d20 + statMod + prof;
    
    setRollResult({
      d20,
      mod: statMod,
      proficiencyBonus: prof,
      total,
      type: 'skill',
      skillName: skill.name,
    });
    
    setTimeout(() => {
      setRollResult(null);
    }, 3000);
  }

  return (
    <div className="p-6 grid grid-cols-12 gap-6">
      {/* Roll Result Display */}
      {rollResult && (
        <div className="col-span-12 mb-4">
          <div className={`card border-2 ${rollingStat ? 'border-accent-primary' : 'border-accent-success'} p-4`}>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-xs text-text-muted uppercase tracking-wide mb-1">d20</div>
                <div className="text-4xl font-bold text-text-primary">{rollResult.d20}</div>
              </div>
              <div className="text-2xl text-text-muted">+</div>
              <div className="text-center">
                <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Mod</div>
                <div className="text-2xl font-bold text-accent-primary">{formatModifier(rollResult.mod)}</div>
              </div>
              {rollResult.proficiencyBonus > 0 && (
                <>
                  <div className="text-2xl text-text-muted">+</div>
                  <div className="text-center">
                    <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Prof</div>
                    <div className="text-2xl font-bold text-accent-success">+{rollResult.proficiencyBonus}</div>
                  </div>
                </>
              )}
              <div className="text-2xl text-text-muted">=</div>
              <div className="text-center">
                <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Totale</div>
                <div className={`text-4xl font-bold ${rollResult.total >= 15 ? 'text-accent-success' : rollResult.total >= 10 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                  {rollResult.total}
                </div>
              </div>
            </div>
            {rollResult.type === 'skill' && (
              <p className="text-center text-sm text-text-muted mt-2">
                Prova di {rollResult.skillName}
              </p>
            )}
            {rollResult.type === 'saving' && (
              <p className="text-center text-sm text-text-muted mt-2">
                Tiro Salvezza di {STAT_FULL_NAMES[rollResult.stat]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Left column: Stats + Saving throws */}
      <div className="col-span-3 space-y-6">
        {/* Stats block */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Caratteristiche</h3>
          <div className="space-y-3">
            {Object.entries(stats).map(([stat, value]) => {
              const mod = getModifier(value);
              return (
                <div key={stat} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-accent-primary w-6">{STAT_LABELS[stat]}</span>
                  <div 
                    className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-bg-tertiary rounded p-1 transition-colors"
                    onClick={() => handleRollStat(stat)}
                    title={`Click per tirare ${STAT_FULL_NAMES[stat]} (1d20 + ${formatModifier(mod)})`}
                  >
                    <div className="w-10 h-10 rounded bg-bg-tertiary border border-border-primary flex items-center justify-center cursor-pointer hover:border-accent-primary transition-colors">
                      <span className="text-sm font-bold text-text-primary">{value}</span>
                    </div>
                    <span className={`text-sm font-medium ${mod >= 0 ? 'text-accent-success' : 'text-text-muted'}`}>
                      {formatModifier(mod)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-text-muted mt-3 text-center">Click su un punteggio per tirare</p>
        </div>

        {/* Saving throws */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Tiri Salvezza</h3>
          <div className="space-y-1">
            {savingThrows.map((st, i) => {
              const mod = getModifier(stats[st.stat]);
              return (
                <div 
                  key={i} 
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-bg-tertiary rounded px-1 py-0.5 transition-colors"
                  onClick={() => handleRollSavingThrow(st)}
                  title={`Tira ${STAT_FULL_NAMES[st.stat]} (1d20 + ${formatModifier(mod)}${st.proficient ? ` + ${character.proficiencyBonus}` : ''})`}
                >
                  <span className={`w-4 text-center ${st.proficient ? 'text-accent-primary' : 'text-text-muted'}`}>
                    {st.proficient ? '●' : '○'}
                  </span>
                  <span className="text-text-secondary w-6">{STAT_LABELS[st.stat]}</span>
                  <span className="text-text-primary font-medium">{formatModifier(mod)}{st.proficient ? ` +${character.proficiencyBonus}` : ''}</span>
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
            <CombatStat label="Initiativa" value={formatModifier(getModifier(stats.dexterity))} />
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
              const statMod = getModifier(stats[skill.stat]);
              return (
                <div 
                  key={i} 
                  className="flex items-center gap-2 py-1 cursor-pointer hover:bg-bg-tertiary rounded px-1 transition-colors"
                  onClick={() => handleRollSkill(skill)}
                  title={`Tira ${skill.name} (1d20 + ${formatModifier(statMod)}${skill.proficient ? ` + ${character.proficiencyBonus}` : ''})`}
                >
                  <span className={`w-4 text-center text-xs ${skill.proficient ? 'text-accent-primary' : 'text-text-muted'}`}>
                    {skill.proficient ? '●' : '○'}
                  </span>
                  <span className="text-text-muted text-xs w-16">{skill.name}</span>
                  <span className="text-text-secondary text-xs">{STAT_LABELS[skill.stat]}</span>
                  <span className={`text-sm font-medium ml-auto ${skill.value >= 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                    {skill.value >= 0 ? '+' : ''}{skill.value}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-text-muted mt-3 text-center">Click su un'abilità per tirare</p>
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
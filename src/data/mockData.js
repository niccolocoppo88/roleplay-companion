// Mock character data for UI development (t_5bd2af81)
// This will be replaced with real SQLite data once t_56ff24ea completes

export const MOCK_CHARACTERS = [
  {
    id: 'char-001',
    name: 'Eldric Vorn',
    race: 'Elfo',
    class: 'Paladino',
    level: 5,
    background: 'Soldato',
    alignment: 'LB',
    xp: 6500,
    maxXp: 9000,
    hitPoints: { current: 44, max: 52, temp: 0 },
    armorClass: 18,
    speed: 30,
    proficiencyBonus: 3,
    inspiration: 0,
    stats: {
      strength: 16,
      dexterity: 10,
      constitution: 14,
      intelligence: 8,
      wisdom: 13,
      charisma: 16,
    },
    savingThrows: [
      { stat: 'strength', proficient: true, value: 5 },
      { stat: 'wisdom', proficient: true, value: 4 },
    ],
    skills: [
      { name: 'Atletica', stat: 'strength', proficient: true, value: 5 },
      { name: 'Intimidazione', stat: 'charisma', proficient: true, value: 5 },
      { name: 'Percezione', stat: 'wisdom', proficient: true, value: 4 },
      { name: 'Sopravvivenza', stat: 'wisdom', proficient: false, value: 1 },
      { name: 'Storia', stat: 'intelligence', proficient: false, value: -1 },
    ],
    inventory: [
      { id: 'inv-1', name: 'Spada lunga +1', type: 'arma', weight: 3, quantity: 1, equipped: true, slot: 'mainHand' },
      { id: 'inv-2', name: 'Scudo +1', type: 'armatura', weight: 6, quantity: 1, equipped: true, slot: 'offHand' },
      { id: 'inv-3', name: 'Armatura di piastre', type: 'armatura', weight: 45, quantity: 1, equipped: true, slot: 'torso' },
      { id: 'inv-4', name: 'Gli spiriti guardinghi (spell)', type: 'incantesimo', weight: 0, quantity: 1, equipped: false },
      { id: 'inv-5', name: 'Pozione di cura', type: 'consumabile', weight: 0.5, quantity: 3, equipped: false },
      { id: 'inv-6', name: 'Cordino', type: 'strumento', weight: 1, quantity: 1, equipped: false },
      { id: 'inv-7', name: 'Torcia', type: 'strumento', weight: 1, quantity: 4, equipped: false },
    ],
    biography: {
      age: 127,
      height: "1.95m",
      weight: "90kg",
      eyes: "grigio-argento",
      hair: "bianco lungo",
      skin: "pallido",
      backstory: "Eldric Vorn servì per decenni come cavaliere dell'ordine del Sole d'Argento prima che la sua missione lo portasse a vagare per il mondo cercando la verità dietro la morte del suo mentore. La sua fede nel dio della luce Torm è incrollabile, e usa la sua autorità clericale tanto quanto la sua lama per proteggere i deboli.",
      personalityTraits: "Credo che le azioni valgano più delle parole. Non spreco tempo a spiegarmi quando non serve. Ma quando parlo, la mia voce fa fermare i conflitti più accesi.",
      ideals: "Tradizione. I metodi dell'ordine sono stati testati nei secoli. Le armi cambiano, ma l'onore resta.",
      bonds: "Un mio commilitone, Dorath, è stato ucciso da un demone che non sono riuscito a sconfiggere. La sua vendetta è la mia missione.",
      flaws: "A volte sono troppo rigido con il protocollo e non mi fido di chi non segue la via del bene.",
    },
    notes: [
      { id: 'note-1', date: '2026-04-12', category: 'session', content: 'Sessione 3: Abbiamo esplorato la cripta sotto la torre di mage. Eldric ha convinto lo spettro a lasciarci passare parlando della sua vecchia missione.' },
      { id: 'note-2', date: '2026-04-19', category: 'dm', content: 'DM: il gruppo ha scoperto che la cripta è collegata al culto del drago nero. Preparare incontro con wyvern nel prossimo sessione.' },
      { id: 'note-3', date: '2026-05-01', category: 'loot', content: 'Trovato: Elisir di Resistenza al Freddo (1), Pozione di Cura (2), 150 monete d\'oro.' },
    ],
    features: [
      { name: 'Sentiero del Devoto', description: 'Guadagni un livello di incantatore multi-classe in clerico. La tua voce sacra ti permette di lanciare spells.', source: 'Paladino' },
      { name: 'Scudo della Fede', description: 'Come azione, puoi invocare uno scudo invisibile che conferisce +2 CA fino a quando non ti muovi, attacchi o lanci un incantesimo.', source: 'Incantesimo' },
      { name: 'Second Wind', description: 'Come azione bonus, guadagni 1d10 + livello PF temporanei. Non puoi usarla di nuovo finché non completi un riposo breve.', source: 'Paladino' },
    ],
    spellcasting: {
      class: 'Paladino',
      ability: 'carisma',
      saveDC: 14,
      attackBonus: 5,
      spells: [
        { level: 0, slots: 0, prepared: ['Sacra fiamma', 'Luce sacra', 'Guidance'], known: 3 },
        { level: 1, slots: 4, used: 2, prepared: ['Detezione del bene e del male', 'Cura ferite', 'Scudo della fede'], known: 5 },
        { level: 2, slots: 2, used: 0, prepared: ['Zone of Truth', 'Spirit Guardians'], known: 4 },
      ],
    },
  },
];

export const MOCK_CAMPAIGNS = [
  {
    id: 'camp-001',
    name: 'L\'ombra del Drago Nero',
    description: 'Una antica minaccia risvegliata minaccia il regno di Valdros',
    createdAt: '2026-03-01',
    characters: ['char-001'],
  },
];
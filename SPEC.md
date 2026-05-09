# Roleplay Companion — SPEC

## 1. Concept & Vision

**Cosa fa:** App desktop che assist Nico (giocatore D&D) durante le sessioni di gioco su Google Meet — analizza i transcript, genera suggerimenti in tempo reale dal punto di vista del suo PG, e dopo ogni sessione crea contenuti creativi (diario, canzoni, memorie, oggetti iconici) dal punto di vista del personaggio.

**Chi la usa:** Solo Nico. Nessun auth, nessun login — app personale.

**Il cuore dell'app:** Il profilo di ogni PG è un "living document" che cresce nel tempo — le sue motivazioni, i suoi piani a lungo termine, i suoi sogni e le sue paure. L'AI aiuta a mantenere questa coerenza e a farla evolvere.

---

## 2. Architettura

```
┌─────────────────────────────────────────────────────────────┐
│  Electron App (React + TypeScript + Zustand)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Dashboard   │  │  PG Profile  │  │  Session Panel   │  │
│  │  Campaigne   │  │  + Journal   │  │  (during Meet)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC
┌──────────────────────────┴──────────────────────────────────┐
│  Python Backend (Electron main process)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  SQLite DB   │  │  Meet Plugin │  │  MiniMax API    │  │
│  │  (local)     │  │  (transcrive)│  │  (generazione)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Plugin Meet:** Utilizza il plugin esistente `google_meet` di Hermes per:
- `hermes meet join <url>` — entra nel Meet
- `hermes meet transcript` — legge il transcript live
- Il transcript viene parsato per identificare i momenti chiave

**LLM:** MiniMax 2.7 tramite l'MCP server `minimax` già configurato in Hermes.

---

## 3. Stack Tecnologico

- **Frontend:** Electron 28, React 18, TypeScript, Zustand, Tailwind CSS
- **Backend:** Python (Electron main process + IPC handlers)
- **Database:** SQLite locale (nessun account, nessun costo, funziona offline)
- **Meet Integration:** Plugin `google_meet` di Hermes (Playwright + captions scraping)
- **LLM:** MiniMax 2.7 tramite MCP minimax (già configurato)
- **Build:** electron-vite

---

## 4. Data Model

### Campaign
```
id: UUID
name: string
description: string
setting: string (world/ambientazione)
status: "active" | "archived"
created_at: datetime
```

### Character (PG)
```
id: UUID
campaign_id: UUID (FK)
name: string
race: string
class: string

# Il cuore del personaggio
backstory: text
personality_traits: text
motivations: text (short e long term)
dreams: text (what the PG hopes for)
fears: text (what the PG avoids)
goals_long_term: text (obiettivi a lungo termine)
goals_short_term: text (obiettivi immediati)

# Tratti specifici per generazione contenuti
musical_talent: boolean (può generare canzoni)
writing_talent: boolean (può generare lettere/scritti)
catchphrases: text[] (modi di dire del PG)
iconic_items: text[] (oggetti iconici del PG)

# Contatori per generazione
sessions_played: int
created_at: datetime
updated_at: datetime
```

### Session
```
id: UUID
campaign_id: UUID (FK)
character_id: UUID (FK)
title: string
date: date
duration_minutes: int
meet_url: string
transcript_path: string (path al file JSON del transcript)
notes_gm: text (note del GM, opzionale)
status: "pending" | "analyzed" | "completed"
created_at: datetime
```

### GeneratedContent
```
id: UUID
character_id: UUID (FK)
session_id: UUID (FK, nullable)
type: "journal" | "song" | "poetry" | "memory" | "catchphrase" | "item" | "letter" | "note"
content: text (contenuto generato in italiano)
context: text (riferimento al momento/motivazione)
generated_at: datetime
```

### KeyMoment
```
id: UUID
session_id: UUID (FK)
transcript_excerpt: text
interpretation: text (cosa è successo)
pg_relevance: "high" | "medium" | "low"
suggestion: text (cosa farebbe/dovrebbe fare il PG)
created_at: datetime
```

---

## 5. Milestones

### M1: Foundation
**Obiettivo:** App shell Electron funzionante + struttura database + UI base

**Task:**
- [ ] M1-T1: Setup progetto Electron con electron-vite + React + TypeScript
- [ ] M1-T2: Configurare Tailwind CSS con dark theme (ref: hermes-desktop-mission-control)
- [ ] M1-T3: Creare database SQLite con schema completo
- [ ] M1-T4: Implementare gestione campagne (CRUD)
- [ ] M1-T5: Implementare gestione PG (CRUD completo)
- [ ] M1-T6: UI Dashboard — lista campagne
- [ ] M1-T7: UI Dettaglio campagna — lista PG
- [ ] M1-T8: UI Profilo PG — tab principale con tutte le sezioni (journal, goals, dreams, fears, etc.)

---

### M2: Meet Integration
**Obiettivo:** Collegamento al Meet, transcript parsing, identificazione momenti chiave

**Task:**
- [ ] M2-T1: Wrapper Python per `hermes meet join/leave/status/transcript`
- [ ] M2-T2: IPC handlers per operazioni Meet (start/stop/status)
- [ ] M2-T3: Transcript parser — estrae speaker + testo + timestamp
- [ ] M2-T4: Key moment detector — identifica momenti rilevanti per il PG
- [ ] M2-T5: UI "Sessione Attiva" — Join meeting + status + stop
- [ ] M2-T6: Salvataggio transcript in sessione
- [ ] M2-T7: Unit tests per Meet integration

---

### M3: Real-Time Suggestions
**Ogettivo:** Suggerimenti dal punto di vista del PG durante la sessione

**Task:**
- [ ] M3-T1: Prompt engineer per suggerimenti PG (MiniMax)
- [ ] M3-T2: Sistema di streaming suggerimenti (polling transcript + analisi)
- [ ] M3-T3: Integrazione Telegram API per inviare suggerimenti in chat privata
- [ ] M3-T4: UI configurazione — quale PG è "attivo" per questa sessione
- [ ] M3-T5: Filtro momenti rilevanti — solo "high" e "medium" priorità
- [ ] M3-T6: Rate limiting — non spammare, solo momenti veramente rilevanti
- [ ] M3-T7: Tests per real-time suggestions

---

### M4: Post-Session Analysis & Generation
**Obiettivo:** Dopo ogni sessione, generare contenuti dal punto di vista del PG

**Task:**
- [ ] M4-T1: Journal generator — prima persona, diario del PG post-sessione
- [ ] M4-T2: Memory creator — identifica e salva i "momenti che il PG ricorda"
- [ ] M4-T3: Catchphrase extractor — identifica battute/iconiche da aggiungere al PG
- [ ] M4-T4: Song/poetry generator — per PG con musical_talent (testo + accordi piano)
- [ ] M4-T5: Letter generator — per PG con writing_talent
- [ ] M4-T6: Iconic item generator — descrizione oggetti memorabili trovati/creati
- [ ] M4-T7: Goals updater — aggiorna long/short term goals in base alla sessione
- [ ] M4-T8: Session summary UI — mostra tutti i contenuti generati post-sessione
- [ ] M4-T9: Tests per generazione contenuti

---

### M5: Polish & The Heart of the Character
**Obiettivo:** Affinare l'esperienza e rendere il profilo PG un "living document" completo

**Task:**
- [ ] M5-T1: Sezione "Dreaming!" — i sogni e le speranze del PG, aggiornati dall'AI
- [ ] M5-T2: Sezione "Fears" — paure e cosa il PG evita
- [ ] M5-T3: Sezione "Motivations" — motivazioni profonde del PG
- [ ] M5-T4: Timeline del PG — cronologia eventi importanti
- [ ] M5-T5: Consistency checker — warn se qualcosa contraddice il profilo
- [ ] M5-T6: UI polish — animazioni, empty states, error handling
- [ ] M5-T7: Build e packaging .app per macOS

---

## 6. Milestone Summary

| Milestone | Focus | Task Count |
|-----------|-------|------------|
| M1 | Foundation — App shell, DB, UI base | 8 |
| M2 | Meet Integration — Transcript + momenti chiave | 7 |
| M3 | Real-Time Suggestions — Whisper al PG | 7 |
| M4 | Post-Session Generation — Journal, canzoni, memorie | 9 |
| M5 | Polish — Cuore del PG + packaging | 7 |
| **Total** | | **38** |

---

## 7. UI Structure

### Dashboard Campagne
```
[Campagna 1: Il Regno Perduto]     [Campagna 2: Le Terre Oscure]
  Party: 4 PG                         Party: 3 PG
  Ultima sessione: 2 giorni fa         Ultima sessione: 1 settimana fa
  [Apri]                             [Apri]
```

### Dettaglio Campagna
```
Il Regno Perduto
Ambientazione: Medioevo fantastico, regno in guerra

PG attivi:
  [Thorin ilnano] [Elara l'elfa] [Marco l'umano]
  Inventario | Diario | Obiettivi | Sogni | Paure | Canzoni

[Avvia Sessione]  [Nuovo PG]  [Archivia Campagna]
```

### Profilo PG (IL CUORE)
```
═══════════════════════════════════════════
THORIN IL NANO
Classe: Guerriero | Razza: Nano | Campagna: Il Regno Perduto
═══════════════════════════════════════════

[BACKSTORY]
Thorin è un nano guerriero esiliato dalla sua clan per un atto
di disonore che non ha commesso. Ora cerca di riconquistare
l'onore perduto combattendo per il Regno.

[GOALS LONG-TERM]
☐ Riconquistare il mio posto nella clan
☐ Trovare chi ha incastrato mio padre
☐ Vendetta o giustizia? (non ho deciso)

[GOALS SHORT-TERM]
○ Scoprire cosa nasconde il consigliere del re
○ Proteggere Elara (欠: mi fido troppo)

[FEARS]
✗ Il fuoco (memories di un incendio nella miniera)
✗ Tradimento da parte di alleati

[DREAMS]
★ Un giorno avrò una birreria tutta mia
★ Voglio che mio nipote sia fiero di me
★ Una battaglia leggendaria che valga una saga

[MUSICAL TALENT: YES]
[CATCHPHRASES]
- "Per il martello di mio padre!"
- "Oro e birra, questo è ciò che conta"
- "I nani non dimenticano mai... quasi mai"

[ICONIC ITEMS]
⚔ La Spada Spezzata (armi ancestrali, non ancora reclamata)
🍺 Il Boccale Incantato (fa sembrare ogni birra la migliore mai bevuta)

───────────────────────────────────────────
SESSIONI
───────────────────────────────────────────
[Sessione 12] 2026-05-07  "La città sotto le montagne"
  Journal: ✓ | Canzone: ✓ | Memoria: 3 | Catchphrase: 1
  [Apri]

[Sessione 11] 2026-05-01  "L'incontro col mercante"
  Journal: ✓ | Canzone: - | Memoria: 1 | Catchphrase: 2
  [Apri]

───────────────────────────────────────────
GENERATI
───────────────────────────────────────────
[Journal entries]
[Canzoni & Poesie]  "La Ballata del Nano Errante"
[Memorie]  "Il tradimento di Korgan"
[Lettere]  "Lettera mai inviata a mio padre"
───────────────────────────────────────────
```

### Sessione Attiva (During Meet)
```
┌─────────────────────────────────────────────┐
│ SESSIONE ATTIVA — Il Regno Perduto          │
│ PG: Thorin  |  Meet: meet.google.com/abc...  │
│ [⏹ Stop Sessione]                           │
├─────────────────────────────────────────────┤
│ ULTIMO SUGGERIMENTO (12:34)                 │
│                                             │
│ "Thorin si fermerebbe qui. Ha visto         │
│ qualcosa di strano nei panni del            │
│ mercante — secondo lui è un segno.         │
│ Potrebbe chiedere a Elara di verificare     │
│ con la magia."                              │
│                                             │
│ [Momento chiave: Interazione sospetta]     │
├─────────────────────────────────────────────┤
│ MOMENTI SALVATI: 4                          │
│ [Lista momenti della sessione]              │
└─────────────────────────────────────────────┘
```

---

## 8. Telegram Integration

I suggerimenti real-time vengono inviati via **Telegram** alla chat privata di Nico.

**Setup:**
- Nico configura il suo `TELEGRAM_CHAT_ID` nelle settings dell'app
- Quando il sistema rileva un momento chiave, manda un messaggio Telegram

**Formato suggerimento:**
```
🎭 [THORIN — momento chiave]

Thorin si fermerebbe qui. Ha visto qualcosa di strano nei panni del mercante — secondo lui è un segno. Potrebbe chiedere a Elara di verificare con la magia.

⏱ 12:34 — Interazione sospetta
```

---

## 9. Color Palette (Dark Theme)

```
Background Primary:   #0D0F14
Background Secondary: #141720
Background Tertiary:  #1C2030
Border Subtle:        #2A2F3D
Text Primary:         #E8E9ED
Text Secondary:       #9CA3AF
Text Muted:           #6B7280
Accent Blue:          #4A9EFF  (link, azioni)
Accent Green:         #3DD68C  (successo, ok)
Accent Amber:         #FFB547  (warning, attenzione)
Accent Red:           #FF6B6B  (errore, paura)
Accent Purple:        #A78BFA  (magia, sogni)
Accent Gold:          #FFD700  (momenti leggendari)
```

---

## 10. Directory Structure

```
roleplay-companion/
├── electron/
│   ├── main.ts              # Main process
│   ├── preload.ts            # contextBridge
│   └── ipc/
│       ├── db.ts             # SQLite handlers
│       ├── meet.ts           # Google Meet handlers
│       ├── telegram.ts       # Telegram notification handlers
│       └── generator.ts      # Content generation handlers
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── TitleBar.tsx
│   │   ├── campaign/
│   │   │   ├── CampaignList.tsx
│   │   │   ├── CampaignDetail.tsx
│   │   │   └── CampaignForm.tsx
│   │   ├── character/
│   │   │   ├── CharacterList.tsx
│   │   │   ├── CharacterProfile.tsx
│   │   │   ├── CharacterForm.tsx
│   │   │   ├── tabs/
│   │   │   │   ├── TabBackstory.tsx
│   │   │   │   ├── TabGoals.tsx
│   │   │   │   ├── TabDreams.tsx
│   │   │   │   ├── TabFears.tsx
│   │   │   │   ├── TabCatchphrases.tsx
│   │   │   │   ├── TabItems.tsx
│   │   │   │   └── TabGenerated.tsx
│   │   │   └── SessionCard.tsx
│   │   ├── session/
│   │   │   ├── ActiveSession.tsx
│   │   │   ├── SessionHistory.tsx
│   │   │   └── SuggestionCard.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Textarea.tsx
│   │       ├── Badge.tsx
│   │       ├── Card.tsx
│   │       └── Modal.tsx
│   ├── hooks/
│   │   ├── useCampaigns.ts
│   │   ├── useCharacters.ts
│   │   ├── useSessions.ts
│   │   └── useMeet.ts
│   ├── stores/
│   │   ├── appStore.ts
│   │   └── sessionStore.ts
│   ├── api/
│   │   └── ipc.ts
│   ├── types/
│   │   ├── campaign.ts
│   │   ├── character.ts
│   │   ├── session.ts
│   │   └── generated.ts
│   └── styles/
│       └── globals.css
├── db/
│   └── schema.sql
├── src-tauri/   (se usiamo Tauri) o  build config
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── electron.vite.config.ts
├── SPEC.md
└── README.md
```

---

## 11. Key Implementation Notes

### Transcript Parsing
Il plugin `google_meet` fornisce il transcript come file JSON strutturato:
```json
[
  {"speaker": "Nico", "text": "Thorin entra nella taverna...", "timestamp": 1700000000},
  {"speaker": "GM", "text": "Il mercante ti guarda sospettosamente...", "timestamp": 1700000060}
]
```

Il sistema aggrega i messaggi e cerca pattern che indicano momenti chiave:
- Dialoghi rilevanti del PG
- Decisioni menzionate
- Interazioni con NPC
- Tensione/combat

### Key Moment Detection (MiniMax Prompt)
```
Analizza questo transcript di una sessione D&D.
Il PG del giocatore è: [nome, backstory, personality traits, goals]

Identifica i momenti chiave dove il PG avrebbe potuto/agito diversamente.
Per ogni momento:
1. Estratto rilevante dal transcript
2. Cosa è successo
3. Cosa farebbe/dovrebbe fare il PG in questo momento
4. Priorità: high/medium/low

Rispondi in italiano.
```

### Journal Generation (MiniMax Prompt)
```
Scrivi una entry del diario di [nome PG] dopo questa sessione di gioco.
Stile: prima persona, come se il personaggio scrivesse nel suo diario la sera.
Includi:
- Cosa è successo (dal punto di vista del PG)
- Come si sente il PG
- Cosa ha imparato
- Cosa计划 per il futuro
- Un momento personale/sentimentale

Lunghezza: 300-500 parole.
Lingua: italiano.
```

### Song Generation (MiniMax Prompt)
```
Scrivi una canzone che [nome PG] (classe: [classe]) potrebbe comporre dopo questa avventura.
Stile: ballata medievale/fantasy.
Includi:
- Strofe (3-4)
- Ritornello
- Accordi base per piano (in formato semplice: Am - G - F - E)

La canzone deve riflettere [traits del PG] e cosa è successo nella sessione.
Lingua: italiano.
```

---

## 12. API Endpoints (IPC)

### Campaigns
- `campaigns:list` → Campaign[]
- `campaigns:create` → Campaign
- `campaigns:get` → Campaign
- `campaigns:update` → Campaign
- `campaigns:delete` → void

### Characters
- `characters:list` (filter by campaign_id) → Character[]
- `characters:create` → Character
- `characters:get` → Character
- `characters:update` → Character
- `characters:delete` → void

### Sessions
- `sessions:list` (filter by campaign_id, character_id) → Session[]
- `sessions:create` → Session
- `sessions:get` → Session
- `sessions:update` → Session
- `sessions:start-meet` → void (join meet)
- `sessions:stop-meet` → void (leave meet)
- `sessions:get-transcript` → TranscriptEntry[]
- `sessions:get-suggestions` → Suggestion[]

### Generated Content
- `generated:list` (filter by character_id, session_id, type) → GeneratedContent[]
- `generated:create` → GeneratedContent
- `generated:get` → GeneratedContent

### Key Moments
- `moments:list` (filter by session_id) → KeyMoment[]
- `moments:create` → KeyMoment

---

## 13. Configurazione

```typescript
// Settings salvate in SQLite, tabella settings
interface AppSettings {
  telegram_chat_id: string;      // Chat ID per notifiche
  minimax_api_key?: string;      // Opzionale, usa quella di Hermes se manca
  meet_join_timeout: number;     // Secondi prima che il bot entri nel meet
  suggestion_priority_filter: "high" | "medium" | "all";
  auto_join_meet: boolean;       // Auto-join quando start session
}
```

---

## 14. Non in Scope (v1)

- ~~Auth/login~~ — solo Nico
- ~~Multiplayer/sharing~~ — no
- ~~Telegram bot per giocatori~~ — solo Nico riceve
- ~~Suno/integratori musicali esterni~~ — generazione testo+accordi solo MiniMax
- ~~Video/audio streaming~~ — solo trascrizione text
- ~~Cloud DB~~ — SQLite locale

---

*Documento creato: 2026-05-09*
*Versione: 1.0.0*

# SPEC.md — Roleplay Companion

## 1. Panoramica del Progetto

**Nome:** Roleplay Companion  
**Descrizione:** Applicazione desktop Electron per GDM (Group Direct Message) di roleplay su Telegram, con integrazione meeting per sessioni live asincrone e sincrone.  
**Repository:** https://github.com/niccolocoppo88/roleplay-companion  
**Board Kanban:** `roleplay-companion`  
**Lingua documentazione:** Italiano (IT)

---

## 2. Architettura di Riferimento

### 2.1 Frontend — Electron App (hermes-desktop-mission-control)

L'app Electron di riferimento utilizza:

- **Electron 28** + **React 18** + **TypeScript**
- **Zustand** per state management
- **TanStack Query** per data fetching
- **Recharts** per grafici
- **Tailwind CSS** per styling
- **electron-vite** per build tooling
- **Dark theme** con palette dedicata

Struttura:
```
electron/
├── main.ts          # Main process entry
├── preload.ts       # contextBridge API
└── ipc/             # IPC handlers
    ├── kanban.ts
    ├── window.ts
    └── logs.ts
src/
├── App.tsx           # Root component
├── main.tsx          # React entry
├── components/
│   ├── layout/       # Sidebar, StatusBar, DetailPanel
│   ├── board/        # BoardView, KanbanColumn, TaskCard
│   ├── profiles/     # ProfilesView, ProfileDetail
│   ├── logs/         # LogStreamView
│   ├── stats/        # StatsView, MetricCard
│   └── ui/           # Button, Input, Badge, Dropdown
├── hooks/            # useKanban, useProfiles, useStats
├── api/              # IPC client
├── stores/           # Zustand store
├── types/            # TypeScript types
└── styles/           # Global CSS
```

### 2.2 Plugin Google Meet

Plugin Hermes esistente per meeting con:

- **meet_join** — entra in una call Google Meet
- **meet_leave** — esce dalla call
- **meet_status** — stato del bot
- **meet_transcript** — legge trascrizione live
- **meet_say** — speak text in call (modalità realtime)

Architettura:
- Playwright per browser automation
- MutationObserver per scraping captions
- OpenAI Realtime per audio duplex (modalità v2)
- Remote node host per esecuzione su macchina separata (v3)

---

## 3. Stack Tecnologico

- **Frontend:** Electron 28, React 18, TypeScript
- **State Management:** Zustand
- **Data Fetching:** TanStack Query
- **Styling:** Tailwind CSS
- **Build Tool:** electron-vite
- **Backend:** Hermes Agent (gateway + plugin system)
- **Meeting Integration:** google_meet plugin (Playwright + OpenAI Realtime)
- **Database:** SQLite (hermes_state.py session store)
- **Platform:** macOS, Linux

---

## 4. Milestone e Task Breakdown

### M1: Auth & User Management
**Obiettivo:** Sistema di autenticazione e gestione profili utente.

**Task M1:**
- [ ] M1-T1: Setup progetto Electron con electron-vite e TypeScript
- [ ] M1-T2: Implementare sistema auth con JWT tokens
- [ ] M1-T3: Creare database SQLite per utenti e sessioni
- [ ] M1-T4: Implementare gestione profili (create, read, update, delete)
- [ ] M1-T5: Creare UI per login/logout e profilo utente
- [ ] M1-T6: Integrare con Hermes state management
- [ ] M1-T7: Scrivere unit tests per auth module
- [ ] M1-T8: Documentazione API auth

---

### M2: Roleplay GDM System
**Obiettivo:** Sistema completo per Group Direct Message di roleplay su Telegram.

**Task M2:**
- [ ] M2-T1: Progettare data model per GDM (gruppi, personaggi, storyline)
- [ ] M2-T2: Implementare repository pattern per GDM entities
- [ ] M2-T3: Creare servizio Telegram GDM con bot integration
- [ ] M2-T4: Implementare gestione personaggi (character sheet, stats)
- [ ] M2-T5: Sistema storyline con archi narrativi e branching
- [ ] M2-T6: UI per creazione e gestione GDM
- [ ] M2-T7: UI per character builder
- [ ] M2-T8: UI per timeline/storyline editor
- [ ] M2-T9: Integrazione with Hermes gateway per message routing
- [ ] M2-T10: Unit tests per GDM core

---

### M3: Meeting Integration
**Obiettivo:** Integrazione con google_meet plugin per sessioni live.

**Task M3:**
- [ ] M3-T1: Wrapper TypeScript per google_meet plugin tools
- [ ] M3-T2: UI per join/leave meeting
- [ ] M3-T3: UI per visualizzazione transcript live
- [ ] M3-T4: Implementare meeting controls (mute, leave, status)
- [ ] M3-T5: Audio bridge setup UI (BlackHole/PulseAudio)
- [ ] M3-T6: Realtime speech integration con meet_say
- [ ] M3-T7: Notification system per eventi meeting
- [ ] M3-T8: Error handling e retry logic
- [ ] M3-T9: Tests per meeting integration

---

### M4: Desktop UI & System Integration
**Obiettivo:** UI Electron completa e integrazione sistema.

**Task M4:**
- [ ] M4-T1: Setup Electron main process con IPC handlers
- [ ] M4-T2: Implementare dark theme system (ref. hermes-desktop-mission-control)
- [ ] M4-T3: Creare layout components (Sidebar, StatusBar, DetailPanel)
- [ ] M4-T4: Kanban board view con drag-and-drop
- [ ] M4-T5: Profiles view e gestione specialist profiles
- [ ] M4-T6: Log stream view real-time
- [ ] M4-T7: Statistics dashboard con Recharts
- [ ] M4-T8: System tray integration con quick actions
- [ ] M4-T9: Keyboard shortcuts (Cmd+B toggle sidebar, etc.)
- [ ] M4-T10: Window controls (minimize, maximize, close)
- [ ] M4-T11: Build e packaging per distribuzione

---

### M5: Plugin System & Extensibility
**Obiettivo:** Sistema di plugin per estendere le funzionalità.

**Task M5:**
- [x] M5-T1: Definire plugin API e contract (shared/plugin.ts)
- [ ] M5-T2: Implementare plugin loader con hot-reload
- [ ] M5-T3: Creare plugin registry system
- [ ] M5-T4: UI per plugin management (enable/disable/configure)
- [ ] M5-T5: Documentazione per sviluppo plugin
- [ ] M5-T6: Esempio plugin template
- [ ] M5-T7: Integration tests per plugin system

---

## 5. Data Model

### User
```
id: string (UUID)
username: string
email: string
password_hash: string
created_at: datetime
updated_at: datetime
```

### Character
```
id: string (UUID)
user_id: string (FK)
name: string
description: text
avatar_url: string
stats: JSON
gdm_id: string (FK, optional)
created_at: datetime
```

### GDM (Group Direct Message)
```
id: string (UUID)
title: string
description: text
owner_id: string (FK)
members: JSON (array of user_ids)
characters: JSON (array of character_ids)
status: enum (active, archived, completed)
created_at: datetime
updated_at: datetime
```

### Storyline
```
id: string (UUID)
gdm_id: string (FK)
title: string
description: text
arcs: JSON (branching narrative structure)
current_node: string
created_at: datetime
```

### Meeting
```
id: string (UUID)
gdm_id: string (FK)
meet_url: string
status: enum (scheduled, active, completed)
transcript_path: string
started_at: datetime
ended_at: datetime
```

### PluginInstance
```
instance_id: string (UUID)
manifest: PluginManifest (inline JSON)
status: enum (loading, enabled, disabled, error, uninstalling)
config: JSON (user overrides)
installed_at: datetime
enabled_at: datetime (optional)
root_path: string
last_error: string (optional)
```

### PluginManifest
```
id: string (unique, e.g. "google-meet")
name: string
version: string (semver)
description: string
author: string
homepage: string (optional)
capabilities: string[] (capability flags)
entry: string (module path, relative to plugin root)
icon: string (optional, relative path)
defaultConfig: JSON (optional)
supportedHooks: string[]
```

---

## 6. API Endpoints

### Auth
- `POST /auth/register` — Registra nuovo utente
- `POST /auth/login` — Login e restituzione JWT
- `POST /auth/refresh` — Refresh token
- `POST /auth/logout` — Logout

### Users
- `GET /users/me` — Profilo utente corrente
- `PUT /users/me` — Aggiorna profilo
- `DELETE /users/me` — Elimina account

### GDM
- `GET /gdm` — Lista GDM dell'utente
- `POST /gdm` — Crea nuovo GDM
- `GET /gdm/:id` — Dettagli GDM
- `PUT /gdm/:id` — Aggiorna GDM
- `DELETE /gdm/:id` — Elimina GDM

### Characters
- `GET /characters` — Lista personaggi
- `POST /characters` — Crea personaggio
- `GET /characters/:id` — Dettagli personaggio
- `PUT /characters/:id` — Aggiorna personaggio
- `DELETE /characters/:id` — Elimina personaggio

### Meetings
- `POST /meetings/join` — join meeting (via google_meet plugin)
- `POST /meetings/leave` — leave meeting
- `GET /meetings/:id/status` — meeting status
- `GET /meetings/:id/transcript` — meeting transcript

---

## 7. Color Palette (Dark Theme)

```
Background Primary:   #0D0F14
Background Secondary:  #141720
Background Tertiary:  #1C2030
Accent Blue:          #4A9EFF
Accent Green:         #3DD68C
Accent Amber:         #FFB547
Accent Red:          #FF6B6B
Accent Purple:        #A78BFA
```

---

## 8. Dipendenze Esterne

### NPM Packages
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.3.0",
  "zustand": "^4.4.0",
  "@tanstack/react-query": "^5.0.0",
  "recharts": "^2.10.0",
  "tailwindcss": "^3.4.0",
  "electron-vite": "^2.0.0",
  "@headlessui/react": "^1.7.0",
  "lucide-react": "^0.300.0",
  "electron-log": "^5.0.0"
}
```

### Python Dependencies (via Hermes)
- `playwright` — Browser automation
- `websockets` — Real-time communication
- `openai` — Realtime API per audio

---

## 9. Struttura File Progetto

```
roleplay-companion/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
│       ├── auth.ts
│       ├── gdm.ts
│       ├── characters.ts
│       ├── meetings.ts
│       └── window.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── DetailPanel.tsx
│   │   ├── board/
│   │   │   ├── BoardView.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── TaskCard.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── gdm/
│   │   │   ├── GDMList.tsx
│   │   │   ├── GDMDetail.tsx
│   │   │   └── GDMForm.tsx
│   │   ├── characters/
│   │   │   ├── CharacterList.tsx
│   │   │   ├── CharacterBuilder.tsx
│   │   │   └── CharacterCard.tsx
│   │   ├── meetings/
│   │   │   ├── MeetingControls.tsx
│   │   │   ├── TranscriptView.tsx
│   │   │   └── AudioBridgeSetup.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Badge.tsx
│   │       └── Dropdown.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGDM.ts
│   │   ├── useCharacters.ts
│   │   └── useMeetings.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── gdmStore.ts
│   │   └── uiStore.ts
│   ├── api/
│   │   ├── client.ts
│   │   └── endpoints.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── gdm.ts
│   │   ├── character.ts
│   │   └── meeting.ts
│   └── styles/
│       └── globals.css
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── electron.vite.config.ts
├── SPEC.md
└── README.md
```

---

## 10. Keyboard Shortcuts

- `Cmd/Ctrl+B` — Toggle sidebar
- `Cmd/Ctrl+K` — Command palette (future)
- `Cmd/Ctrl+N` — New GDM
- `Cmd/Ctrl+,` — Settings

---

## 11. Note di Implementazione

### Plugin Integration
L'integrazione con il google_meet plugin segue il pattern esistente:
1. Tool handlers esposti via `tools.py`
2. Node client per remote hosting
3. Process manager per bot lifecycle
4. Audio bridge per realtime audio

### State Management
- Zustand per UI state locale
- TanStack Query per server state
- Hermes state (SQLite) per persistenza

### IPC Communication
- Main process gestisce native operations
- Preload espone API sicura via contextBridge
- Renderer usa IPC client per comunicazione

---

## 12. Milestone Summary

| Milestone | Focus | Task Count |
|-----------|-------|------------|
| M1 | Auth & User Management | 8 |
| M2 | Roleplay GDM System | 10 |
| M3 | Meeting Integration | 9 |
| M4 | Desktop UI & System | 11 |
| M5 | Plugin System | 7 |
| **Total** | | **45** |

---

*Documento creato: 2026-05-08*
*Ultimo aggiornamento: 2026-05-08*
*Versione: 1.0.0*
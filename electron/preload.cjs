const { contextBridge, ipcRenderer } = require('electron');

// ─── Campaign channels ─────────────────────────────────────────────────────────
const campaigns = {
  list:   ()    => ipcRenderer.invoke('db:campaigns:list'),
  get:    (id)  => ipcRenderer.invoke('db:campaigns:get', id),
  create: (f)   => ipcRenderer.invoke('db:campaigns:create', f),
  update: (f)   => ipcRenderer.invoke('db:campaigns:update', f),
  delete: (id)  => ipcRenderer.invoke('db:campaigns:delete', id),
};

// ─── Character channels ────────────────────────────────────────────────────────
const characters = {
  list:   (campaignId) => ipcRenderer.invoke('db:characters:list', campaignId),
  get:    (id)         => ipcRenderer.invoke('db:characters:get', id),
  create: (f)          => ipcRenderer.invoke('db:characters:create', f),
  update: (f)          => ipcRenderer.invoke('db:characters:update', f),
  delete: (id)         => ipcRenderer.invoke('db:characters:delete', id),
};

// ─── Session channels ────────────────────────────────────────────────────────────
const sessions = {
  list:   (campaignId) => ipcRenderer.invoke('db:sessions:list', campaignId),
  get:    (id)          => ipcRenderer.invoke('db:sessions:get', id),
  create: (f)           => ipcRenderer.invoke('db:sessions:create', f),
  update: (f)           => ipcRenderer.invoke('db:sessions:update', f),
  delete: (id)          => ipcRenderer.invoke('db:sessions:delete', id),
};

// ─── Character Goals channels ───────────────────────────────────────────────────
const goals = {
  list:   (characterId) => ipcRenderer.invoke('db:goals:list', characterId),
  get:    (characterId) => ipcRenderer.invoke('db:goals:get', characterId),
  create: (f)           => ipcRenderer.invoke('db:goals:create', f),
  update: (f)           => ipcRenderer.invoke('db:goals:update', f),
};

// ─── Session Transcript channels ───────────────────────────────────────────────
const transcripts = {
  list:   (sessionId)   => ipcRenderer.invoke('db:transcripts:list', sessionId),
  create: (f)           => ipcRenderer.invoke('db:transcripts:create', f),
};

// ─── Meet API channels ─────────────────────────────────────────────────────────
const meet = {
  join:   (opts)        => ipcRenderer.invoke('meet:join', opts?.url ?? opts),
  status: ()            => ipcRenderer.invoke('meet:status'),
  stop:   ()            => ipcRenderer.invoke('meet:stop'),
  transcript: ()        => ipcRenderer.invoke('meet:transcript'),
  parseTranscript: (p, ml) => ipcRenderer.invoke('meet:parse_transcript', { filePath: p, maxLines: ml }),
  detectMoments: (rec, mc) => ipcRenderer.invoke('meet:detect_moments', { records: rec, minConfidence: mc }),
  sessionCreate: (f)   => ipcRenderer.invoke('meet:session_create', f),
  sessionSync: (sid, tp, mc) => ipcRenderer.invoke('meet:session_sync', { sessionId: sid, transcriptPath: tp, minConfidence: mc }),
  sessionGet: (sid)    => ipcRenderer.invoke('meet:session_get', { sessionId: sid }),
  sessionEnd: (sid, st, nt) => ipcRenderer.invoke('meet:session_end', { sessionId: sid, status: st, notes: nt }),
};

// ─── Generated Content channels ───────────────────────────────────────────────
const generated = {
  list: (characterId)  => ipcRenderer.invoke('db:generated:list', characterId),
  get:  (id)          => ipcRenderer.invoke('db:generated:get', id),
  create: (f)         => ipcRenderer.invoke('db:generated:create', f),
};

// ─── Content Generation channels ───────────────────────────────────────────────
const gen = {
  generate: ({ sessionId, characterId, type, params }) =>
    ipcRenderer.invoke('gen:generate', { sessionId, characterId, type, params }),
};

// ─── Consistency channels ───────────────────────────────────────────────────────
const consistency = {
  check: (character, content) =>
    ipcRenderer.invoke('consistency:check', { character, content }),
  rules: () => ipcRenderer.invoke('consistency:rules'),
};

// ─── Settings & Presets channels ───────────────────────────────────────────────
const settings = {
  get: (key) => ipcRenderer.invoke('db:settings:get', key),
  set: (key, value) => ipcRenderer.invoke('db:settings:set', { key, value }),
};

const presets = {
  list: () => ipcRenderer.invoke('db:presets:list'),
  create: (f) => ipcRenderer.invoke('db:presets:create', f),
  delete: (id) => ipcRenderer.invoke('db:presets:delete', id),
};

contextBridge.exposeInMainWorld('db', { campaigns, characters, sessions, goals, generated, moments: { list: (s) => ipcRenderer.invoke('db:moments:list', s), create: (f) => ipcRenderer.invoke('db:moments:create', f) }, templates: { list: () => ipcRenderer.invoke('db:templates:list'), get: (id) => ipcRenderer.invoke('db:templates:get', id), create: (f) => ipcRenderer.invoke('db:templates:create', f), delete: (id) => ipcRenderer.invoke('db:templates:delete', id) }, dice: { list: () => ipcRenderer.invoke('db:dice:list'), create: (f) => ipcRenderer.invoke('db:dice:create', f) }, settings, presets });
contextBridge.exposeInMainWorld('gen', gen);
contextBridge.exposeInMainWorld('meetAPI', meet);
contextBridge.exposeInMainWorld('transcripts', transcripts);
contextBridge.exposeInMainWorld('consistency', consistency);
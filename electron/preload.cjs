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

contextBridge.exposeInMainWorld('db', { campaigns, characters });
/**
 * electron/database.cjs
 * SQLite database layer using better-sqlite3.
 * All DB operations go through IPC — this module runs in the main process.
 */
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'roleplay-companion.db');
}

function openDatabase() {
  if (db) return db;
  const dbPath = getDbPath();
  log.info('Opening database at:', dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    log.info('Database closed');
  }
}

// ─── Migrations ────────────────────────────────────────────────────────────────

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS campaigns (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS characters (
        id          TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        name        TEXT NOT NULL,
        class       TEXT DEFAULT '',
        race        TEXT DEFAULT '',
        level       INTEGER DEFAULT 1,
        backstory   TEXT DEFAULT '',
        portrait    TEXT DEFAULT '',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_characters_campaign
        ON characters(campaign_id);
    `,
  },
  {
    version: 2,
    name: 'sessions_table',
    up: `
      CREATE TABLE IF NOT EXISTS sessions (
        id           TEXT PRIMARY KEY,
        campaign_id  TEXT NOT NULL,
        character_id TEXT,
        title        TEXT DEFAULT '',
        meet_url     TEXT DEFAULT '',
        started_at   INTEGER,
        ended_at     INTEGER,
        status       TEXT DEFAULT 'pending',
        created_at   INTEGER NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_campaign
        ON sessions(campaign_id);
    `,
  },
  {
    version: 3,
    name: 'generated_contents_table',
    up: `
      CREATE TABLE IF NOT EXISTS generated_contents (
        id           TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        session_id   TEXT,
        type         TEXT NOT NULL,
        content      TEXT NOT NULL,
        context      TEXT NOT NULL,
        generated_at REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gc_character ON generated_contents(character_id);
      CREATE INDEX IF NOT EXISTS idx_gc_session  ON generated_contents(session_id);
    `,
  },
];

function runMigrations() {
  const database = openDatabase();

  // Ensure migrations table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((r) => r.version)
  );

  for (const m of MIGRATIONS) {
    if (!applied.has(m.version)) {
      log.info(`Running migration ${m.version}: ${m.name}`);
      database.exec(m.up);
      database
        .prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        )
        .run(m.version, m.name, Date.now());
      log.info(`Migration ${m.version} applied`);
    }
  }

  log.info('Migrations complete, current schema version:', MIGRATIONS.length);
}

// ─── Campaign operations ──────────────────────────────────────────────────────

const stmts = {
  // Campaigns
  listCampaigns: null,   // assigned after db open
  getCampaign: null,
  insertCampaign: null,
  updateCampaign: null,
  deleteCampaign: null,

  // Characters
  listCharacters: null,
  getCharacter: null,
  insertCharacter: null,
  updateCharacter: null,
  deleteCharacter: null,

  // Generated Contents
  listGenerated: null,
  getGenerated: null,
}

function prepareStatements() {
  const database = openDatabase();

  stmts.listCampaigns = database.prepare(`
    SELECT * FROM campaigns ORDER BY updated_at DESC
  `);

  stmts.getCampaign = database.prepare(`
    SELECT * FROM campaigns WHERE id = ?
  `);

  stmts.insertCampaign = database.prepare(`
    INSERT INTO campaigns (id, name, description, created_at, updated_at)
    VALUES (@id, @name, @description, @created_at, @updated_at)
  `);

  stmts.updateCampaign = database.prepare(`
    UPDATE campaigns
       SET name = @name, description = @description, updated_at = @updated_at
     WHERE id = @id
  `);

  stmts.deleteCampaign = database.prepare(`
    DELETE FROM campaigns WHERE id = ?
  `);

  // Characters
  stmts.listCharacters = database.prepare(`
    SELECT * FROM characters WHERE campaign_id = ? ORDER BY name ASC
  `);

  stmts.getCharacter = database.prepare(`
    SELECT * FROM characters WHERE id = ?
  `);

  stmts.insertCharacter = database.prepare(`
    INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
    VALUES (@id, @campaign_id, @name, @class, @race, @level, @backstory, @portrait, @created_at, @updated_at)
  `);

  stmts.updateCharacter = database.prepare(`
    UPDATE characters
       SET name = @name, class = @class, race = @race, level = @level,
           backstory = @backstory, portrait = @portrait, updated_at = @updated_at
     WHERE id = @id
  `);

  stmts.deleteCharacter = database.prepare(`
    DELETE FROM characters WHERE id = ?
  `);

  // Generated Contents
  stmts.listGenerated = database.prepare(`
    SELECT * FROM generated_contents
    WHERE character_id = ?
    ORDER BY generated_at DESC
  `);

  stmts.getGenerated = database.prepare(`
    SELECT * FROM generated_contents WHERE id = ?
  `);

  log.info('Prepared statements ready');
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerHandlers() {
  const { ipcMain } = require('electron');

  // Campaigns
  ipcMain.handle('db:campaigns:list', () => {
    try {
      return { ok: true, data: stmts.listCampaigns.all() };
    } catch (err) {
      log.error('db:campaigns:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:campaigns:get', (_, id) => {
    try {
      const row = stmts.getCampaign.get(id);
      return { ok: true, data: row ?? null };
    } catch (err) {
      log.error('db:campaigns:get error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:campaigns:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = { ...fields, created_at: now, updated_at: now };
      stmts.insertCampaign.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:campaigns:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:campaigns:update', (_, fields) => {
    try {
      const row = { ...fields, updated_at: Date.now() };
      stmts.updateCampaign.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:campaigns:update error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:campaigns:delete', (_, id) => {
    try {
      stmts.deleteCampaign.run(id);
      return { ok: true };
    } catch (err) {
      log.error('db:campaigns:delete error', err);
      return { ok: false, error: err.message };
    }
  });

  // Characters
  ipcMain.handle('db:characters:list', (_, campaignId) => {
    try {
      return { ok: true, data: stmts.listCharacters.all(campaignId) };
    } catch (err) {
      log.error('db:characters:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:characters:get', (_, id) => {
    try {
      const row = stmts.getCharacter.get(id);
      return { ok: true, data: row ?? null };
    } catch (err) {
      log.error('db:characters:get error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:characters:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = { ...fields, created_at: now, updated_at: now };
      stmts.insertCharacter.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:characters:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:characters:update', (_, fields) => {
    try {
      const row = { ...fields, updated_at: Date.now() };
      stmts.updateCharacter.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:characters:update error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:characters:delete', (_, id) => {
    try {
      stmts.deleteCharacter.run(id);
      return { ok: true };
    } catch (err) {
      log.error('db:characters:delete error', err);
      return { ok: false, error: err.message };
    }
  });

  // Generated Contents
  ipcMain.handle('db:generated:list', (_, characterId) => {
    try {
      const rows = stmts.listGenerated.all(characterId);
      return { ok: true, data: rows };
    } catch (err) {
      log.error('db:generated:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:generated:get', (_, id) => {
    try {
      const row = stmts.getGenerated.get(id);
      return { ok: true, data: row ?? null };
    } catch (err) {
      log.error('db:generated:get error', err);
      return { ok: false, error: err.message };
    }
  });

  log.info('IPC handlers registered');
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  openDatabase,
  closeDatabase,
  runMigrations,
  prepareStatements,
  registerHandlers,
};
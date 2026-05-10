/**
 * electron/database.cjs
 * SQLite database layer using better-sqlite3.
 * All DB operations go through IPC — this module runs in the main process.
 */
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { spawn } = require('child_process');
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
  {
    version: 4,
    name: 'character_talent_columns',
    up: `
      ALTER TABLE characters ADD COLUMN writing_talent INTEGER DEFAULT 0;
      ALTER TABLE characters ADD COLUMN musical_talent  INTEGER DEFAULT 0;
      ALTER TABLE characters ADD COLUMN catchphrases   TEXT DEFAULT '[]';
      ALTER TABLE characters ADD COLUMN iconic_items   TEXT DEFAULT '[]';
    `,
  },
  {
    version: 5,
    name: 'iconic_items_table',
    up: `
      CREATE TABLE IF NOT EXISTS iconic_items (
        id           TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        session_id   TEXT,
        item_name    TEXT NOT NULL,
        description  TEXT NOT NULL,
        generated_at REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ii_character ON iconic_items(character_id);
      CREATE INDEX IF NOT EXISTS idx_ii_session  ON iconic_items(session_id);
    `,
  },
  {
    version: 6,
    name: 'character_goals_table',
    up: `
      CREATE TABLE IF NOT EXISTS character_goals (
        id              TEXT PRIMARY KEY,
        character_id    TEXT NOT NULL,
        long_term_goals TEXT DEFAULT '[]',
        short_term_goals TEXT DEFAULT '[]',
        current_quest   TEXT DEFAULT '',
        updated_at      INTEGER NOT NULL,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_goals_character ON character_goals(character_id);
    `,
  },
  {
    version: 7,
    name: 'session_transcripts_table',
    up: `
      CREATE TABLE IF NOT EXISTS session_transcripts (
        id           TEXT PRIMARY KEY,
        session_id   TEXT NOT NULL,
        content      TEXT NOT NULL,
        duration_sec INTEGER,
        recorded_at  INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_transcripts_session ON session_transcripts(session_id);
    `,
  },
  {
    version: 8,
    name: 'session_moments_and_character_stats',
    up: `
      CREATE TABLE IF NOT EXISTS session_moments (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        note        TEXT DEFAULT '',
        timestamp_ms INTEGER,
        created_at  INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_moments_session ON session_moments(session_id);

      ALTER TABLE characters ADD COLUMN hp_current INTEGER DEFAULT 0;
      ALTER TABLE characters ADD COLUMN hp_max INTEGER DEFAULT 0;
      ALTER TABLE characters ADD COLUMN inspiration INTEGER DEFAULT 0;
      ALTER TABLE characters ADD COLUMN conditions TEXT DEFAULT '[]';
      ALTER TABLE characters ADD COLUMN campaign_notes TEXT DEFAULT '';
    `,
  },
  {
    version: 9,
    name: 'campaign_templates',
    up: `
      CREATE TABLE IF NOT EXISTS campaign_templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT DEFAULT '',
        content     TEXT NOT NULL,
        category    TEXT DEFAULT '',
        created_at  INTEGER NOT NULL
      );
    `,
  },
  {
    version: 10,
    name: 'dice_rolls_table',
    up: `
      CREATE TABLE IF NOT EXISTS dice_rolls (
        id          TEXT PRIMARY KEY,
        session_id  TEXT,
        character_id TEXT,
        notation    TEXT NOT NULL,
        result      INTEGER NOT NULL,
        breakdown   TEXT DEFAULT '',
        rolled_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dice_session ON dice_rolls(session_id);
      CREATE INDEX IF NOT EXISTS idx_dice_character ON dice_rolls(character_id);
    `,
  },
  {
    version: 11,
    name: 'quick_notes_table',
    up: `
      CREATE TABLE IF NOT EXISTS quick_notes (
        id          TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_notes_campaign ON quick_notes(campaign_id);
    `,
  },
  {
    version: 12,
    name: 'campaign_templates_category_index',
    up: `
      CREATE INDEX IF NOT EXISTS idx_templates_category ON campaign_templates(category);
    `,
  },
  {
    version: 13,
    name: 'settings_and_meet_presets',
    up: `
      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meet_presets (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        url         TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );
    `,
  },
  {
    version: 14,
    name: 'session_ratings',
    up: `
      ALTER TABLE sessions ADD COLUMN rating INTEGER;
      ALTER TABLE sessions ADD COLUMN rating_note TEXT;
    `,
  },
  {
    version: 15,
    name: 'character_mood',
    up: `
      ALTER TABLE characters ADD COLUMN mood TEXT DEFAULT 'neutral';
      ALTER TABLE characters ADD COLUMN mood_updated_at INTEGER;
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
  insertGenerated: null,

  // Sessions
  listSessions: null,
  getSession: null,
  insertSession: null,
  updateSession: null,
  deleteSession: null,

  // Character Goals
  listGoals: null,
  getGoals: null,
  insertGoals: null,
  updateGoals: null,

  // Session Transcripts
  listTranscripts: null,
  insertTranscript: null,

  // Session Moments
  listMoments: null,
  insertMoment: null,

  // Campaign Templates
  listTemplates: null,
  getTemplate: null,
  insertTemplate: null,
  deleteTemplate: null,

  // Dice Rolls
  listDiceRolls: null,
  listDiceRollsBySession: null,
  insertDiceRoll: null,

  // Quick Notes
  listNotes: null,
  insertNote: null,
  deleteNote: null,
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
    INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at, writing_talent, musical_talent, catchphrases, iconic_items)
    VALUES (@id, @campaign_id, @name, @class, @race, @level, @backstory, @portrait, @created_at, @updated_at, @writing_talent, @musical_talent, @catchphrases, @iconic_items)
  `);

  stmts.updateCharacter = database.prepare(`
    UPDATE characters
       SET name = @name, class = @class, race = @race, level = @level,
           backstory = @backstory, portrait = @portrait, updated_at = @updated_at,
           writing_talent = @writing_talent, musical_talent = @musical_talent,
           catchphrases = @catchphrases, iconic_items = @iconic_items
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

  stmts.insertGenerated = database.prepare(`
    INSERT INTO generated_contents (id, character_id, session_id, type, content, context, generated_at)
    VALUES (@id, @character_id, @session_id, @type, @content, @context, @generated_at)
  `);

  // Sessions
  stmts.listSessions = database.prepare(`
    SELECT s.*, c.name as character_name
    FROM sessions s
    LEFT JOIN characters c ON s.character_id = c.id
    WHERE s.campaign_id = ?
    ORDER BY s.started_at DESC
  `);

  stmts.getSession = database.prepare(`
    SELECT s.*, c.name as character_name
    FROM sessions s
    LEFT JOIN characters c ON s.character_id = c.id
    WHERE s.id = ?
  `);

  stmts.insertSession = database.prepare(`
    INSERT INTO sessions (id, campaign_id, character_id, title, meet_url, started_at, ended_at, status, created_at)
    VALUES (@id, @campaign_id, @character_id, @title, @meet_url, @started_at, @ended_at, @status, @created_at)
  `);

  stmts.updateSession = database.prepare(`
    UPDATE sessions
       SET title = @title, character_id = @character_id, meet_url = @meet_url,
           started_at = @started_at, ended_at = @ended_at, status = @status
     WHERE id = @id
  `);

  stmts.deleteSession = database.prepare(`
    DELETE FROM sessions WHERE id = ?
  `);

  // Character Goals
  stmts.listGoals = database.prepare(`
    SELECT g.*, c.name as character_name
    FROM character_goals g
    JOIN characters c ON g.character_id = c.id
    WHERE g.character_id = ?
  `);

  stmts.getGoals = database.prepare(`
    SELECT g.*, c.name as character_name
    FROM character_goals g
    JOIN characters c ON g.character_id = c.id
    WHERE g.character_id = ?
  `);

  stmts.insertGoals = database.prepare(`
    INSERT INTO character_goals (id, character_id, long_term_goals, short_term_goals, current_quest, updated_at)
    VALUES (@id, @character_id, @long_term_goals, @short_term_goals, @current_quest, @updated_at)
  `);

  stmts.updateGoals = database.prepare(`
    UPDATE character_goals
       SET long_term_goals = @long_term_goals, short_term_goals = @short_term_goals,
           current_quest = @current_quest, updated_at = @updated_at
     WHERE character_id = @character_id
  `);

  // Session Transcripts
  stmts.listTranscripts = database.prepare(`
    SELECT * FROM session_transcripts WHERE session_id = ? ORDER BY recorded_at DESC
  `);

  stmts.insertTranscript = database.prepare(`
    INSERT INTO session_transcripts (id, session_id, content, duration_sec, recorded_at)
    VALUES (@id, @session_id, @content, @duration_sec, @recorded_at)
  `);

  // Session Moments
  stmts.listMoments = database.prepare(`
    SELECT * FROM session_moments WHERE session_id = ? ORDER BY created_at DESC
  `);

  stmts.insertMoment = database.prepare(`
    INSERT INTO session_moments (id, session_id, note, timestamp_ms, created_at)
    VALUES (@id, @session_id, @note, @timestamp_ms, @created_at)
  `);

  // Campaign Templates
  stmts.listTemplates = database.prepare(`
    SELECT * FROM campaign_templates ORDER BY name ASC
  `);

  stmts.getTemplate = database.prepare(`
    SELECT * FROM campaign_templates WHERE id = ?
  `);

  stmts.insertTemplate = database.prepare(`
    INSERT INTO campaign_templates (id, name, description, content, category, created_at)
    VALUES (@id, @name, @description, @content, @category, @created_at)
  `);

  stmts.deleteTemplate = database.prepare(`
    DELETE FROM campaign_templates WHERE id = ?
  `);

  // Dice Rolls
  stmts.listDiceRolls = database.prepare(`
    SELECT * FROM dice_rolls ORDER BY rolled_at DESC LIMIT 50
  `);

  stmts.listDiceRollsBySession = database.prepare(`
    SELECT * FROM dice_rolls WHERE session_id = ? ORDER BY rolled_at DESC
  `);

  stmts.insertDiceRoll = database.prepare(`
    INSERT INTO dice_rolls (id, session_id, character_id, notation, result, breakdown, rolled_at)
    VALUES (@id, @session_id, @character_id, @notation, @result, @breakdown, @rolled_at)
  `);

  // Quick Notes
  stmts.listNotes = database.prepare(`
    SELECT * FROM quick_notes WHERE campaign_id = ? ORDER BY created_at DESC
  `);

  stmts.insertNote = database.prepare(`
    INSERT INTO quick_notes (id, campaign_id, content, created_at)
    VALUES (@id, @campaign_id, @content, @created_at)
  `);

  stmts.deleteNote = database.prepare(`
    DELETE FROM quick_notes WHERE id = ?
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
      const row = { id: require('crypto').randomUUID(), ...fields, created_at: now, updated_at: now };
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
      const row = { id: require('crypto').randomUUID(), ...fields, created_at: now, updated_at: now };
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

  ipcMain.handle('db:generated:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = { id: require('crypto').randomUUID(), ...fields, generated_at: fields.generated_at ?? now };
      stmts.insertGenerated.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:generated:create error', err);
      return { ok: false, error: err.message };
    }
  });

  // ─── Content Generation (M4 family: journal, memory, catchphrase, song, letter, item, note, goals_update) ──
  ipcMain.handle('gen:generate', async (_, { sessionId, characterId, type, params }) => {
    try {
      const generatorBin = path.join(process.env.HOME || '', '.hermes', 'hermes-agent', 'venv', 'bin', 'python3');
      const pythonPath = path.join(__dirname, '..', 'python');

      const typeToFunc = {
        journal:        { module: 'generators.journal_generator',  func: 'generate_journal' },
        memory:         { module: 'generators.memory_generator',   func: 'generate_memory' },
        catchphrase:    { module: 'generators.catchphrase_generator', func: 'extract_catchphrase' },
        song:           { module: 'generators.song_generator',    func: 'generate_song' },
        letter:         { module: 'generators.letter_generator',  func: 'generate_letter' },
        item:           { module: 'generators.item_generator',    func: 'generate_item_description' },
        goals_update:   { module: 'generators.goals_updater',     func: 'update_goals' },
      };

      const entry = typeToFunc[type];
      if (!entry) {
        return { ok: false, error: `Unknown generator type: ${type}` };
      }
      const { func: funcName } = entry;

      // Build kwargs matching what each generator expects
      let kwargs;
      if (type === 'letter') {
        kwargs = { session_id: sessionId, character_id: characterId, recipient: params?.recipient ?? '', purpose: params?.purpose ?? '' };
      } else if (type === 'goals_update') {
        kwargs = { session_id: sessionId, character_id: characterId, completed_objectives: params?.completedObjectives ?? '' };
      } else if (type === 'catchphrase') {
        kwargs = { character_id: characterId, recent_dialogue: params?.recentDialogue ?? '', context: params?.context ?? '' };
      } else if (type === 'item') {
        kwargs = { session_id: sessionId, character_id: characterId, item_name: params?.item_name ?? '', item_origin: params?.item_origin ?? '', session_context: params?.session_context ?? '' };
      } else {
        kwargs = { session_id: sessionId, character_id: characterId };
      }

      const code = [
        `import sys`,
        `sys.path.insert(0, '${pythonPath}')`,
        `import json`,
        `from ${entry.module} import ${funcName}`,
        `kwargs = json.loads(sys.stdin.read())`,
        `result = ${funcName}(**kwargs)`,
        `print(json.dumps(result, default=str))`,
      ].join('\n');

      const result = await new Promise((resolve, reject) => {
        const proc = spawn(generatorBin, ['-c', code], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });
        let stdout = '', stderr = '';
        proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
        proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
        proc.on('close', (code_) => {
          if (code_ !== 0) reject(new Error(stderr || `python exited ${code_}`));
          else resolve(stdout.trim());
        });
        proc.on('error', err => reject(err));
        proc.stdin.write(JSON.stringify(kwargs));
        proc.stdin.end();
      });

      const parsed = JSON.parse(result);

      // ─── Telegram notification for iconic items (M4-T6) ───
      if (type === 'item' && parsed) {
        const itemData = parsed;
        const tgText = [
          `⚔️ *Oggetto Iconico generato*`,
          ``,
          `*${itemData.item_name || 'Oggetto senza nome'}*`,
          ``,
          itemData.description || '',
          ``,
          `🆔 ${itemData.id}`,
        ].join('\n');
        _sendTelegramNotification(tgText);
      }

      return { ok: true, data: parsed };
    } catch (err) {
      log.error('gen:generate error', err);
      return { ok: false, error: err.message };
    }
  });

  // Sessions
  ipcMain.handle('db:sessions:list', (_, campaignId) => {
    try {
      return { ok: true, data: stmts.listSessions.all(campaignId) };
    } catch (err) {
      log.error('db:sessions:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:sessions:get', (_, id) => {
    try {
      const row = stmts.getSession.get(id);
      return { ok: true, data: row ?? null };
    } catch (err) {
      log.error('db:sessions:get error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:sessions:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        campaign_id: fields.campaign_id ?? null,
        character_id: fields.character_id ?? null,
        title: fields.title ?? '',
        meet_url: fields.meet_url ?? '',
        started_at: fields.started_at ?? now,
        ended_at: fields.ended_at ?? null,
        status: fields.status ?? 'pending',
        created_at: now,
      };
      stmts.insertSession.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:sessions:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:sessions:update', (_, fields) => {
    try {
      stmts.updateSession.run(fields);
      return { ok: true, data: fields };
    } catch (err) {
      log.error('db:sessions:update error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:sessions:delete', (_, id) => {
    try {
      stmts.deleteSession.run(id);
      return { ok: true };
    } catch (err) {
      log.error('db:sessions:delete error', err);
      return { ok: false, error: err.message };
    }
  });

  // Character Goals
  ipcMain.handle('db:goals:list', (_, characterId) => {
    try {
      const rows = stmts.listGoals.all(characterId);
      return { ok: true, data: rows };
    } catch (err) {
      log.error('db:goals:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:goals:get', (_, characterId) => {
    try {
      const row = stmts.getGoals.get(characterId);
      return { ok: true, data: row ?? null };
    } catch (err) {
      log.error('db:goals:get error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:goals:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        character_id: fields.character_id,
        long_term_goals: fields.long_term_goals ?? '[]',
        short_term_goals: fields.short_term_goals ?? '[]',
        current_quest: fields.current_quest ?? '',
        updated_at: now,
      };
      stmts.insertGoals.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:goals:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:goals:update', (_, fields) => {
    try {
      const row = { ...fields, updated_at: Date.now() };
      stmts.updateGoals.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:goals:update error', err);
      return { ok: false, error: err.message };
    }
  });

  // Session Transcripts
  ipcMain.handle('db:transcripts:list', (_, sessionId) => {
    try {
      const rows = stmts.listTranscripts.all(sessionId);
      return { ok: true, data: rows };
    } catch (err) {
      log.error('db:transcripts:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:transcripts:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        session_id: fields.session_id,
        content: fields.content ?? '',
        duration_sec: fields.duration_sec ?? null,
        recorded_at: now,
      };
      stmts.insertTranscript.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:transcripts:create error', err);
      return { ok: false, error: err.message };
    }
  });

  // Session Moments
  ipcMain.handle('db:moments:list', (_, sessionId) => {
    try {
      const rows = stmts.listMoments.all(sessionId);
      return { ok: true, data: rows };
    } catch (err) {
      log.error('db:moments:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:moments:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        session_id: fields.session_id,
        note: fields.note ?? '',
        timestamp_ms: fields.timestamp_ms ?? null,
        created_at: now,
      };
      stmts.insertMoment.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:moments:create error', err);
      return { ok: false, error: err.message };
    }
  });

  // Campaign Templates
  ipcMain.handle('db:templates:list', () => {
    try {
      return { ok: true, data: stmts.listTemplates.all() };
    } catch (err) {
      log.error('db:templates:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:templates:get', (_, id) => {
    try {
      const row = stmts.getTemplate.get(id);
      return { ok: true, data: row ?? null };
    } catch (err) {
      log.error('db:templates:get error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:templates:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        name: fields.name,
        description: fields.description ?? '',
        content: typeof fields.content === 'string' ? fields.content : JSON.stringify(fields.content),
        category: fields.category ?? '',
        created_at: now,
      };
      stmts.insertTemplate.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:templates:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:templates:delete', (_, id) => {
    try {
      stmts.deleteTemplate.run(id);
      return { ok: true };
    } catch (err) {
      log.error('db:templates:delete error', err);
      return { ok: false, error: err.message };
    }
  });

  // Dice Rolls
  ipcMain.handle('db:dice:list', () => {
    try {
      return { ok: true, data: stmts.listDiceRolls.all() };
    } catch (err) {
      log.error('db:dice:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:dice:listBySession', (_, sessionId) => {
    try {
      return { ok: true, data: stmts.listDiceRollsBySession.all(sessionId) };
    } catch (err) {
      log.error('db:dice:listBySession error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:dice:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        session_id: fields.session_id ?? null,
        character_id: fields.character_id ?? null,
        notation: fields.notation,
        result: fields.result,
        breakdown: fields.breakdown ?? '',
        rolled_at: now,
      };
      stmts.insertDiceRoll.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:dice:create error', err);
      return { ok: false, error: err.message };
    }
  });

  // Quick Notes
  ipcMain.handle('db:notes:list', (_, campaignId) => {
    try {
      return { ok: true, data: stmts.listNotes.all(campaignId) };
    } catch (err) {
      log.error('db:notes:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:notes:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        campaign_id: fields.campaign_id,
        content: fields.content,
        created_at: now,
      };
      stmts.insertNote.run(row);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:notes:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:notes:delete', (_, id) => {
    try {
      stmts.deleteNote.run(id);
      return { ok: true };
    } catch (err) {
      log.error('db:notes:delete error', err);
      return { ok: false, error: err.message };
    }
  });

  log.info('IPC handlers registered');
}

// ─── Settings and Meet Presets ─────────────────────────────────────────────────

function prepareSettingsStatements() {
  const database = openDatabase();
  stmts.getSetting = database.prepare('SELECT value FROM settings WHERE key = ?');
  stmts.setSetting = database.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  stmts.listPresets = database.prepare('SELECT * FROM meet_presets ORDER BY created_at DESC');
  stmts.getPreset = database.prepare('SELECT * FROM meet_presets WHERE id = ?');
  stmts.insertPreset = database.prepare('INSERT INTO meet_presets (id, name, url, created_at) VALUES (?, ?, ?, ?)');
  stmts.deletePreset = database.prepare('DELETE FROM meet_presets WHERE id = ?');
}

function registerSettingsHandlers() {
  // Settings
  ipcMain.handle('db:settings:get', (_, key) => {
    try {
      const row = stmts.getSetting.get(key);
      return { ok: true, data: row ? row.value : null };
    } catch (err) {
      log.error('db:settings:get error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:settings:set', (_, { key, value }) => {
    try {
      stmts.setSetting.run(key, value, Date.now());
      return { ok: true };
    } catch (err) {
      log.error('db:settings:set error', err);
      return { ok: false, error: err.message };
    }
  });

  // Meet Presets
  ipcMain.handle('db:presets:list', () => {
    try {
      return { ok: true, data: stmts.listPresets.all() };
    } catch (err) {
      log.error('db:presets:list error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:presets:create', (_, fields) => {
    try {
      const now = Date.now();
      const row = {
        id: require('crypto').randomUUID(),
        name: fields.name,
        url: fields.url,
        created_at: now,
      };
      stmts.insertPreset.run(row.id, row.name, row.url, row.created_at);
      return { ok: true, data: row };
    } catch (err) {
      log.error('db:presets:create error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:presets:delete', (_, id) => {
    try {
      stmts.deletePreset.run(id);
      return { ok: true };
    } catch (err) {
      log.error('db:presets:delete error', err);
      return { ok: false, error: err.message };
    }
  });

  // Session ratings
  ipcMain.handle('db:sessions:rate', (_, { sessionId, rating, ratingNote }) => {
    try {
      const database = openDatabase();
      database.prepare('UPDATE sessions SET rating = ?, rating_note = ? WHERE id = ?').run(rating, ratingNote || '', sessionId);
      return { ok: true };
    } catch (err) {
      log.error('db:sessions:rate error', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:campaigns:getAverageRating', (_, campaignId) => {
    try {
      const database = openDatabase();
      const row = database.prepare('SELECT AVG(rating) as avg FROM sessions WHERE campaign_id = ? AND rating IS NOT NULL').get(campaignId);
      return { ok: true, data: row?.avg ?? null };
    } catch (err) {
      log.error('db:campaigns:getAverageRating error', err);
      return { ok: false, error: err.message };
    }
  });

  log.info('Settings & presets IPC handlers registered');
}


// ─── Telegram notification (M4-T6) ──────────────────────────────────────────

function _getTelegramHandle() {
  // Read NICO_TELEGRAM_HANDLE from env or ~/.hermes/telegram_handle file
  const envHandle = process.env.NICO_TELEGRAM_HANDLE;
  if (envHandle) return envHandle;
  const fs = require('fs');
  const handlePath = require('path').join(require('os').homedir(), '.hermes', 'telegram_handle');
  try {
    return fs.readFileSync(handlePath, 'utf8').trim();
  } catch {
    return null;
  }
}

function _sendTelegramNotification(text) {
  const handle = _getTelegramHandle();
  if (!handle) {
    log.warn('[telegram] NICO_TELEGRAM_HANDLE not set and no ~/.hermes/telegram_handle file — skipping notification');
    return;
  }
  const pythonPath = path.join(__dirname, '..', 'python');
  const generatorBin = path.join(process.env.HOME || '', '.hermes', 'hermes-agent', 'venv', 'bin', 'python3');
  const code = [
    `import sys`,
    `sys.path.insert(0, '${pythonPath}')`,
    `from telegram_bot import send_dm`,
    `result = send_dm('${handle}', ${JSON.stringify(text)})`,
    `print('OK' if result else 'FAIL')`,
  ].join('\n');
  const proc = require('child_process').spawn(generatorBin, ['-c', code], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  proc.stdout.on('data', d => { stdout += d.toString(); });
  proc.stderr.on('data', d => { stderr += d.toString(); });
  proc.on('close', code_ => {
    if (code_ !== 0) log.error('[telegram] notification failed:', stderr || stdout);
    else log.info('[telegram] notification sent to', handle);
  });
  proc.stdin.end();
}


// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  openDatabase,
  closeDatabase,
  runMigrations,
  prepareStatements,
  registerHandlers,
  _stmts: stmts,
};
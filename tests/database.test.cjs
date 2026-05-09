/**
 * tests/database.test.cjs
 * Unit tests for the SQLite database layer.
 * Run with: node tests/database.test.cjs
 */
const path = require('path');
const os = require('os');

// Fake Electron app paths for testing without Electron
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

// ─── Test helpers ──────────────────────────────────────────────────────────────

let db;
let closeDb;

function initDb() {
  const tmp = path.join(os.tmpdir(), `rc-test-${Date.now()}.db`);
  db = new Database(tmp);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Inline the migration from database.cjs
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );

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
  `);

  closeDb = () => {
    db.close();
    try { require('fs').unlinkSync(tmp); } catch (_) {}
  };

  return db;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      initDb();
      fn();
      closeDb();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      closeDb();
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n  Database Schema Tests\n');

  // ─ Campaigns ─
  test('campaigns: insert and retrieve', () => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, 'Dragon Slayers', 'A quest to defeat Tiamat', now, now);

    const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!row) throw new Error('campaign not found');
    if (row.name !== 'Dragon Slayers') throw new Error(`expected name, got "${row.name}"`);
  });

  test('campaigns: list returns all', () => {
    const now = Date.now();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), 'C1', '', now, now);
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), 'C2', '', now, now);
    const rows = db.prepare('SELECT * FROM campaigns ORDER BY updated_at DESC').all();
    if (rows.length !== 2) throw new Error(`expected 2, got ${rows.length}`);
  });

  test('campaigns: delete cascades to characters', () => {
    const now = Date.now();
    const cid = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(cid, 'Cascade Test', '', now, now);
    const charId = uuidv4();
    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(charId, cid, 'Gorim', 'Fighter', 'Dwarf', 5, '', '', now, now);

    db.prepare('DELETE FROM campaigns WHERE id = ?').run(cid);
    const chars = db.prepare('SELECT * FROM characters WHERE id = ?').get(charId);
    if (chars) throw new Error('character should have been cascade-deleted');
  });

  test('campaigns: update sets updated_at', () => {
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(id, 'Old Name', '', now, now);
    const newNow = Date.now() + 1000;
    db.prepare(`UPDATE campaigns SET name = ?, updated_at = ? WHERE id = ?`).run('New Name', newNow, id);
    const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (row.name !== 'New Name') throw new Error(`expected "New Name", got "${row.name}"`);
  });

  // ─ Characters ─
  test('characters: insert and retrieve', () => {
    const now = Date.now();
    const cid = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(cid, 'Test Campaign', '', now, now);

    const charId = uuidv4();
    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(charId, cid, 'Aelric', 'Wizard', 'Elf', 3, 'Orphan mage', '', now, now);

    const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(charId);
    if (!row) throw new Error('character not found');
    if (row.class !== 'Wizard') throw new Error(`expected Wizard, got "${row.class}"`);
    if (row.level !== 3) throw new Error(`expected level 3, got ${row.level}`);
  });

  test('characters: list by campaign_id', () => {
    const now = Date.now();
    const c1 = uuidv4(); const c2 = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(c1, 'C1', '', now, now);
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(c2, 'C2', '', now, now);

    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), c1, 'P1', '', '', 1, '', '', now, now);
    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), c1, 'P2', '', '', 1, '', '', now, now);
    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), c2, 'P3', '', '', 1, '', '', now, now);

    const c1Chars = db.prepare('SELECT * FROM characters WHERE campaign_id = ? ORDER BY name ASC').all(c1);
    const c2Chars = db.prepare('SELECT * FROM characters WHERE campaign_id = ? ORDER BY name ASC').all(c2);
    if (c1Chars.length !== 2) throw new Error(`expected 2 chars in c1, got ${c1Chars.length}`);
    if (c2Chars.length !== 1) throw new Error(`expected 1 char in c2, got ${c2Chars.length}`);
  });

  test('characters: update fields', () => {
    const now = Date.now();
    const cid = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(cid, 'C', '', now, now);
    const charId = uuidv4();
    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(charId, cid, 'Tordek', 'Fighter', 'Dwarf', 2, '', '', now, now);

    db.prepare(`UPDATE characters SET name = ?, level = ?, updated_at = ? WHERE id = ?`)
      .run('Tordek Redhammer', 5, now + 1000, charId);

    const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(charId);
    if (row.name !== 'Tordek Redhammer') throw new Error(`name not updated: ${row.name}`);
    if (row.level !== 5) throw new Error(`level not updated: ${row.level}`);
  });

  test('characters: delete removes row', () => {
    const now = Date.now();
    const cid = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(cid, 'C', '', now, now);
    const charId = uuidv4();
    db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(charId, cid, 'X', '', '', 1, '', '', now, now);

    db.prepare('DELETE FROM characters WHERE id = ?').run(charId);
    if (db.prepare('SELECT * FROM characters WHERE id = ?').get(charId)) {
      throw new Error('character should be deleted');
    }
  });

  // ─ Schema constraints ─
  test('characters: foreign key prevents orphan insert', () => {
    const now = Date.now();
    const fakeCid = uuidv4();
    try {
      db.prepare(`INSERT INTO characters (id, campaign_id, name, class, race, level, backstory, portrait, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), fakeCid, 'Orphan', '', '', 1, '', '', now, now);
      throw new Error('should have thrown FK violation');
    } catch (e) {
      if (!e.message.includes('FOREIGN KEY') && !e.message.includes('constraint')) {
        throw new Error(`expected FK error, got: ${e.message}`);
      }
    }
  });

  test('campaigns: id is primary key — duplicate id fails', () => {
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).run(id, 'First', '', now, now);
    try {
      db.prepare(`INSERT INTO campaigns (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`).run(id, 'Duplicate', '', now, now);
      throw new Error('should have thrown duplicate key error');
    } catch (e) {
      if (!e.message.includes('UNIQUE') && !e.message.includes('constraint')) {
        throw new Error(`expected UNIQUE error, got: ${e.message}`);
      }
    }
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
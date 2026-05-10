/**
 * electron/ipc/generator.cjs
 * M4-T7: Goals updater — IPC bridge to Python content generators.
 * Handles: goals_update, journal, memory, catchphrase, song, letter, item.
 */

const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const log = require('electron-log');
const path = require('path');
const os = require('os');

// ─── Paths ─────────────────────────────────────────────────────────────────────

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
const PYTHON_BIN = path.join(HERMES_HOME, 'hermes-agent', 'venv', 'bin', 'python3');
// electron/ipc/.. = electron/, so electron/../python = python/
const ELECTRON_PYTHON = path.join(__dirname, '..', '..', 'python');

// ─── Python runner ─────────────────────────────────────────────────────────────

/**
 * Run a Python generator function and return parsed JSON result.
 * @param {string} moduleName  - e.g. 'generators.goals_updater'
 * @param {string} funcName    - e.g. 'update_goals'
 * @param {object} kwargs      - keyword arguments passed as JSON to the function
 */
function runPythonGenerator(moduleName, funcName, kwargs) {
  return new Promise((resolve, reject) => {
    // Escape backslashes for Python raw string on Windows/macOS paths
    const pythonPath = ELECTRON_PYTHON.replace(/\\/g, '\\\\');

    const code = [
      `import sys`,
      `sys.path.insert(0, r'${pythonPath}')`,
      `import json`,
      `from ${moduleName} import ${funcName}`,
      `kwargs = json.loads(sys.stdin.read())`,
      `result = ${funcName}(**kwargs)`,
      `print(json.dumps(result, default=str))`,
    ].join('\n');

    const child = spawn(PYTHON_BIN, ['-c', code], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', err => reject(new Error(`spawn error: ${err.message}`)));

    child.on('close', code_ => {
      if (code_ !== 0) {
        log.error(`[generator] ${moduleName}.${funcName} stderr: ${stderr}`);
        reject(new Error(stderr || `Python exited ${code_}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`invalid JSON from ${moduleName}.${funcName}: ${stdout.trim()}`));
      }
    });

    child.stdin.write(JSON.stringify(kwargs));
    child.stdin.end();
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────────

function registerHandlers() {

  // goals:update — M4-T7 core deliverable
  ipcMain.handle('goals:update', async (_, { sessionId, characterId, completedObjectives, dbPath }) => {
    try {
      const result = await runPythonGenerator(
        'generators.goals_updater',
        'update_goals',
        { session_id: sessionId, character_id: characterId, completed_objectives: completedObjectives, db_path: dbPath }
      );
      return { ok: true, data: result };
    } catch (err) {
      log.error('goals:update error', err);
      return { ok: false, error: err.message };
    }
  });

  // content:generate — generic dispatcher for all other generators
  ipcMain.handle('content:generate', async (_, { generator, sessionId, characterId, params, dbPath }) => {
    const generatorMap = {
      journal:     'generators.journal_generator',
      memory:      'generators.memory_generator',
      catchphrase: 'generators.catchphrase_generator',
      song:        'generators.song_generator',
      letter:      'generators.letter_generator',
      item:        'generators.item_generator',
    };

    const moduleName = generatorMap[generator];
    if (!moduleName) {
      return { ok: false, error: `Unknown generator: ${generator}` };
    }

    try {
      const kwargs = { session_id: sessionId, character_id: characterId, db_path: dbPath, ...params };
      // Detect correct function name per module
      const funcName = generator === 'catchphrase' ? 'extract_catchphrase'
        : generator === 'item' ? 'generate_item_description'
        : 'generate';
      const result = await runPythonGenerator(moduleName, funcName, kwargs);
      return { ok: true, data: result };
    } catch (err) {
      log.error(`content:generate[${generator}] error`, err);
      return { ok: false, error: err.message };
    }
  });

  log.info('Generator IPC handlers registered');
}

module.exports = { registerHandlers };
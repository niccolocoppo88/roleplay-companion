/**
 * electron/meet.cjs
 * Python wrapper for the hermes google_meet plugin.
 *
 * Uses the hermes-agent venv Python (python3 from the hermes-agent .venv)
 * to call the plugin's process_manager.start/status/stop/transcript functions.
 * All file paths are under $HERMES_HOME so they persist across runs.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const log = require('electron-log');

// ─── Python interpreter ───────────────────────────────────────────────────────

const PYTHON = path.join(
  process.env.HERMES_HOME || path.join(os.homedir(), '.hermes'),
  'hermes-agent',
  'venv',
  'bin',
  'python3'
);

// ─── Python entry point ──────────────────────────────────────────────────────

const PLUGIN_ROOT = path.join(
  process.env.HERMES_HOME || path.join(os.homedir(), '.hermes'),
  'hermes-agent',
  'plugins',
  'google_meet'
);

/**
 * Call a Python function in the google_meet.process_manager namespace.
 * @param {string} fnName - e.g. "start", "status", "stop", "transcript"
 * @param {object|null} kwargs - keyword arguments as a plain JS object
 * @returns {Promise<object>} parsed JSON response from Python
 */
function _pyCall(fnName, kwargs = null) {
  return new Promise((resolve, reject) => {
    const args = [
      '-c',
      `
import sys
sys.path.insert(0, ${JSON.stringify(PLUGIN_ROOT)})
from plugins.google_meet import process_manager as pm
import json

fn = ${fnName}
kwargs = ${kwargs != null ? JSON.stringify(kwargs) : 'None'}
if kwargs is None:
    result = fn()
else:
    result = fn(**kwargs)
print(json.dumps(result, ensure_ascii=False))
`,
    ];

    const proc = spawn(PYTHON, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure hermes home is set so get_hermes_home() resolves
        HERMES_HOME: process.env.HERMES_HOME || path.join(os.homedir(), '.hermes'),
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0 || stderr) {
        log.error(`meet._pyCall(${fnName}) python stderr:\n${stderr}`);
        reject(new Error(stderr || `python exit code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        log.error(`meet._pyCall(${fnName}) JSON parse error:\n${stdout}`);
        reject(new Error(`JSON parse error: ${e.message}`));
      }
    });

    proc.on('error', reject);
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * Register meet IPC handlers on the Electron main process.
 * Called once during app startup after db.registerHandlers().
 */
function registerHandlers() {
  const { ipcMain } = require('electron');

  // meet:join  — start the bot and join a Meet URL
  ipcMain.handle('meet:join', async (_, { url, guest_name, duration, mode, headed }) => {
    try {
      const kwargs = {
        url,
        headed: headed === true,
        guest_name: guest_name || 'Hermes Agent',
        mode: mode || 'transcribe',
        duration: duration || null,
      };
      const result = await _pyCall('pm.start', kwargs);
      return result;
    } catch (err) {
      log.error('meet:join error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:status  — is the bot alive, how many lines transcribed
  ipcMain.handle('meet:status', async () => {
    try {
      const result = await _pyCall('pm.status');
      return result;
    } catch (err) {
      log.error('meet:status error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:transcript  — read transcript (optionally last-N lines)
  ipcMain.handle('meet:transcript', async (_, { last } = {}) => {
    try {
      const kwargs = last != null ? { last } : null;
      const result = await _pyCall('pm.transcript', kwargs);
      return result;
    } catch (err) {
      log.error('meet:transcript error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:leave  — cleanly leave the meeting
  ipcMain.handle('meet:leave', async () => {
    try {
      const result = await _pyCall('pm.stop', { reason: 'electron-meet-leave' });
      return result;
    } catch (err) {
      log.error('meet:leave error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:say  — enqueue text to speak (realtime mode only)
  ipcMain.handle('meet:say', async (_, { text }) => {
    try {
      const result = await _pyCall('pm.enqueue_say', { text });
      return result;
    } catch (err) {
      log.error('meet:say error', err);
      return { ok: false, error: err.message };
    }
  });

  log.info('meet IPC handlers registered');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { registerHandlers };
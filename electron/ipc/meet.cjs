/**
 * electron/ipc/meet.cjs
 * IPC handlers for Google Meet integration.
 * Spawns `hermes meet join` as a background process and exposes
 * join / stop / status / transcript operations to the renderer.
 */
const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const log = require('electron-log');
const path = require('path');

// ─── State ─────────────────────────────────────────────────────────────────────

/** @type {{ pid: number, proc: import('child_process').ChildProcess, meetUrl: string } | null} */
let activeSession = null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get the path to the hermes CLI.
 * Assumes this runs on the same machine as the Hermes gateway.
 */
function getHermesBin() {
  // Try the user's local bin first
  return '/Users/niccolocoppo/.local/bin/hermes';
}

/**
 * Spawn a hermes meet join process.
 * The plugin uses Playwright to control a Chrome browser signed into Google.
 * @param {string} meetUrl
 * @returns {{ pid: number, url: string }}
 */
function startMeet(meetUrl) {
  if (activeSession && activeSession.proc && !activeSession.proc.killed) {
    throw new Error('A Meet session is already active. Stop it first.');
  }

  const hermesBin = getHermesBin();
  log.info(`Starting Meet session: ${meetUrl}`);

  const proc = spawn(hermesBin, ['meet', 'join', meetUrl], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Ensure hermes uses the local profile for credentials
      HERMES_CONFIG_DIR: path.join(process.env.HOME || '', '.hermes'),
    },
  });

  proc.stdout.on('data', (chunk) => {
    log.info(`[meet:stdout] ${chunk.toString().trim()}`);
  });

  proc.stderr.on('data', (chunk) => {
    log.warn(`[meet:stderr] ${chunk.toString().trim()}`);
  });

  proc.on('exit', (code) => {
    log.info(`Meet process exited with code ${code}`);
    activeSession = null;
  });

  proc.on('error', (err) => {
    log.error('Meet process error:', err);
    activeSession = null;
  });

  activeSession = { pid: proc.pid, proc, meetUrl };
  log.info(`Meet session started with PID ${proc.pid}`);

  return { pid: proc.pid, url: meetUrl };
}

/**
 * Stop the active Meet session.
 * @returns {{ stopped: boolean, reason?: string }}
 */
function stopMeet() {
  if (!activeSession) {
    return { stopped: false, reason: 'No active session' };
  }

  const { proc, meetUrl } = activeSession;
  log.info(`Stopping Meet session (PID ${proc.pid})`);

  try {
    // Try SIGTERM first (graceful)
    proc.kill('SIGTERM');

    // Give it 3 seconds then SIGKILL if still alive
    const timer = setTimeout(() => {
      if (!proc.killed) {
        log.warn('Meet process did not exit gracefully, sending SIGKILL');
        proc.kill('SIGKILL');
      }
    }, 3000);

    proc.on('close', () => {
      clearTimeout(timer);
      activeSession = null;
    });
  } catch (err) {
    log.error('Error stopping Meet session:', err);
    activeSession = null;
    return { stopped: false, reason: err.message };
  }

  activeSession = null;
  return { stopped: true };
}

/**
 * Get the current Meet session status.
 * @returns {{ active: boolean, pid?: number, url?: string }}
 */
function getStatus() {
  if (!activeSession) {
    return { active: false };
  }

  const { pid, proc, meetUrl } = activeSession;

  // Check if the process is still alive
  const alive = proc && !proc.killed && proc.exitCode === null;

  if (!alive) {
    activeSession = null;
    return { active: false };
  }

  return { active: true, pid, url: meetUrl };
}

/**
 * Fetch the current transcript by calling `hermes meet transcript`.
 * Returns raw text lines from the Meet plugin's caption scrape.
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function getTranscript() {
  return new Promise((resolve) => {
    const hermesBin = getHermesBin();
    const proc = spawn(hermesBin, ['meet', 'transcript'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        log.warn(`hermes meet transcript exited with code ${code}: ${stderr}`);
        resolve({ ok: false, error: stderr || `exit code ${code}` });
      } else {
        resolve({ ok: true, data: stdout.trim() });
      }
    });

    proc.on('error', (err) => {
      log.error('hermes meet transcript error:', err);
      resolve({ ok: false, error: err.message });
    });
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerHandlers() {
  // meet:join — start a Meet session
  ipcMain.handle('meet:join', async (_, meetUrl) => {
    try {
      if (!meetUrl || typeof meetUrl !== 'string') {
        return { ok: false, error: 'meetUrl is required' };
      }
      // Basic URL validation
      if (!meetUrl.includes('meet.google.com') && !meetUrl.includes('jitsi')) {
        return { ok: false, error: 'Invalid Meet URL' };
      }
      const result = startMeet(meetUrl);
      return { ok: true, data: result };
    } catch (err) {
      log.error('meet:join error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:stop — stop the active Meet session
  ipcMain.handle('meet:stop', async () => {
    try {
      const result = stopMeet();
      return { ok: true, data: result };
    } catch (err) {
      log.error('meet:stop error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:status — get current session status
  ipcMain.handle('meet:status', async () => {
    try {
      const status = getStatus();
      return { ok: true, data: status };
    } catch (err) {
      log.error('meet:status error', err);
      return { ok: false, error: err.message };
    }
  });

  // meet:transcript — fetch current transcript from the Meet plugin
  ipcMain.handle('meet:transcript', async () => {
    try {
      const result = await getTranscript();
      return result;
    } catch (err) {
      log.error('meet:transcript error', err);
      return { ok: false, error: err.message };
    }
  });

  log.info('Meet IPC handlers registered');
}

module.exports = { registerHandlers };
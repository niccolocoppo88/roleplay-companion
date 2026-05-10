/**
 * electron/meet.cjs
 * IPC bridge to the hermes-agent Python environment for Meet integration.
 *
 * Handles two aspects:
 * 1. Lifecycle: meet:join / meet:stop / meet:status — spawns the hermes meet
 *    background process and tracks its PID.
 * 2. Transcript analysis: meet:parse_transcript / meet:detect_moments /
 *    meet:session_* — calls the hermes-agent venv Python to run the
 *    meet_transcript_parser, meet_key_moments, and meet_session_store modules.
 *
 * Both paths are exposed through the same set of IPC handlers so the
 * renderer sees a consistent interface regardless of which backend handles
 * the request.
 */

const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const log = require('electron-log');

// ─── Paths ─────────────────────────────────────────────────────────────────────

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
const PYTHON_BIN = path.join(HERMES_HOME, 'hermes-agent', 'venv', 'bin', 'python3');
const HERMES_AGENT_ROOT = path.join(HERMES_HOME, 'hermes-agent');
const ELECTRON_PYTHON = path.join(__dirname, 'python');

// ─── Meet session state ────────────────────────────────────────────────────────

/** @type {{ pid: number, proc: import('child_process').ChildProcess, meetUrl: string, dbSessionId: string | null, startedAt: number } | null} */
let activeSession = null;

/** @type {object | null} */
let _dbStmts = null;

function setupDatabase(stmts) {
  _dbStmts = stmts;
}

function _createDbSession(meetUrl) {
  if (!_dbStmts) return null;
  try {
    const now = Date.now();
    const id = require('crypto').randomUUID();
    _dbStmts.insertSession.run({
      id,
      campaign_id: null,
      character_id: null,
      title: `Meet Session ${new Date().toLocaleString()}`,
      meet_url: meetUrl,
      started_at: now,
      ended_at: null,
      status: 'active',
      created_at: now,
    });
    return id;
  } catch (err) {
    log.warn('_createDbSession error:', err.message);
    return null;
  }
}

function _endDbSession(sessionId, status) {
  if (!_dbStmts || !sessionId) return;
  try {
    _dbStmts.updateSession.run({
      id: sessionId,
      title: null,
      character_id: null,
      meet_url: null,
      started_at: null,
      ended_at: Date.now(),
      status: status ?? 'ended',
    });
  } catch (err) {
    log.warn('_endDbSession error:', err.message);
  }
}

// ─── hermes CLI helpers ────────────────────────────────────────────────────────

function getHermesBin() {
  return '/Users/niccolocoppo/.local/bin/hermes';
}

function startMeet(meetUrl) {
  if (activeSession && activeSession.proc && !activeSession.proc.killed) {
    throw new Error('A Meet session is already active. Stop it first.');
  }
  const hermesBin = getHermesBin();
  log.info(`Starting Meet session: ${meetUrl}`);
  const proc = spawn(hermesBin, ['meet', 'join', meetUrl], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HERMES_CONFIG_DIR: path.join(process.env.HOME || '', '.hermes') },
  });
  proc.stdout.on('data', (chunk) => { log.info(`[meet:stdout] ${chunk.toString().trim()}`); });
  proc.stderr.on('data', (chunk) => { log.warn(`[meet:stderr] ${chunk.toString().trim()}`); });
  proc.on('exit', (code) => {
    log.info(`Meet process exited with code ${code}`);
    if (activeSession) {
      _endDbSession(activeSession.dbSessionId, 'ended');
      activeSession = null;
    }
  });
  proc.on('error', (err) => {
    log.error('Meet process error:', err);
    if (activeSession) {
      _endDbSession(activeSession.dbSessionId, 'error');
      activeSession = null;
    }
  });
  const startedAt = Date.now();
  const dbSessionId = _createDbSession(meetUrl);
  activeSession = { pid: proc.pid, proc, meetUrl, dbSessionId, startedAt };
  log.info(`Meet session started with PID ${proc.pid}, dbSessionId=${dbSessionId}`);
  return { pid: proc.pid, url: meetUrl, dbSessionId };
}

function stopMeet() {
  if (!activeSession) return { stopped: false, reason: 'No active session' };
  const { proc, dbSessionId } = activeSession;
  log.info(`Stopping Meet session (PID ${proc.pid})`);
  try {
    proc.kill('SIGTERM');
    const timer = setTimeout(() => {
      if (!proc.killed) { log.warn('Meet process did not exit gracefully, sending SIGKILL'); proc.kill('SIGKILL'); }
    }, 3000);
    proc.on('close', () => {
      clearTimeout(timer);
      _endDbSession(dbSessionId, 'stopped');
      activeSession = null;
    });
  } catch (err) {
    log.error('Error stopping Meet session:', err);
    _endDbSession(dbSessionId, 'error');
    activeSession = null;
    return { stopped: false, reason: err.message };
  }
  activeSession = null;
  return { stopped: true };
}

function getStatus() {
  if (!activeSession) return { active: false };
  const { pid, proc, meetUrl } = activeSession;
  const alive = proc && !proc.killed && proc.exitCode === null;
  if (!alive) { activeSession = null; return { active: false }; }
  return { active: true, pid, url: meetUrl };
}

function getTranscript() {
  return new Promise((resolve) => {
    const hermesBin = getHermesBin();
    const proc = spawn(hermesBin, ['meet', 'transcript'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) resolve({ ok: false, error: stderr || `exit code ${code}` });
      else resolve({ ok: true, data: stdout.trim() });
    });
    proc.on('error', (err) => { log.error('hermes meet transcript error:', err); resolve({ ok: false, error: err.message }); });
  });
}

// ─── Python helpers (transcript analysis) ─────────────────────────────────────

function _pyCall(moduleName, funcName, args = []) {
  return new Promise((resolve, reject) => {
    const code = [
      `import sys`,
      `sys.path.insert(0, '${HERMES_AGENT_ROOT}')`,
      `sys.path.insert(0, '${ELECTRON_PYTHON}')`,
      `import json`,
      `from ${moduleName} import ${funcName}`,
      `result = ${funcName}(*json.loads(sys.stdin.read()))`,
      `print(json.dumps(result))`,
    ].join('\n');

    const child = spawn(PYTHON_BIN, ['-c', code], {
      cwd: HERMES_AGENT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => { reject(new Error(`spawn error: ${err.message}`)); });

    child.on('close', (code_) => {
      if (code_ !== 0) {
        log.error(`meet._pyCall[${moduleName}.${funcName}] stderr: ${stderr}`);
        reject(new Error(`Python exited ${code_}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`invalid JSON from ${moduleName}.${funcName}: ${stdout.trim()}`));
      }
    });

    child.stdin.write(JSON.stringify(args));
    child.stdin.end();
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerMeetHandlers() {

  // --- Meet lifecycle (hermes CLI) -----------------------------------------
  ipcMain.handle('meet:join', async (_, meetUrl) => {
    try {
      if (!meetUrl || typeof meetUrl !== 'string') return { ok: false, error: 'meetUrl è obbligatorio' };
      if (!meetUrl.includes('meet.google.com') && !meetUrl.includes('jitsi')) return { ok: false, error: 'URL Meet non valido' };
      const result = startMeet(meetUrl);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:join error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:session_duration', async () => {
    try {
      if (!activeSession) return { ok: false, error: 'Nessuna sessione attiva' };
      const durationSec = Math.floor((Date.now() - activeSession.startedAt) / 1000);
      return { ok: true, data: { durationSec, startedAt: activeSession.startedAt } };
    } catch (err) { log.error('meet:session_duration error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:stop', async () => {
    try { return { ok: true, data: stopMeet() }; }
    catch (err) { log.error('meet:stop error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:status', async () => {
    try {
      const status = getStatus();
      return { ok: true, data: status };
    } catch (err) { log.error('meet:status error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:transcript', async () => {
    try { return await getTranscript(); }
    catch (err) { log.error('meet:transcript error', err); return { ok: false, error: err.message }; }
  });

  // --- Transcript analysis (Python) ----------------------------------------
  ipcMain.handle('meet:parse_transcript', async (_, { filePath, maxLines }) => {
    try {
      const args = [{ path: filePath }];
      if (maxLines !== undefined) args.push(maxLines);
      const result = await _pyCall('meet_transcript_parser', 'parse_transcript', args);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:parse_transcript error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:detect_moments', async (_, { records, minConfidence }) => {
    try {
      const args = [records];
      if (minConfidence !== undefined) args.push(minConfidence);
      const result = await _pyCall('meet_key_moments', 'detect_moments', args);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:detect_moments error', err); return { ok: false, error: err.message }; }
  });

  // --- Session storage (Python) ---------------------------------------------
  ipcMain.handle('meet:session_create', async (_, fields) => {
    try {
      const result = await _pyCall('meet_session_store', '_session_create', [fields]);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:session_create error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:session_sync', async (_, { sessionId, transcriptPath, minConfidence }) => {
    try {
      const result = await _pyCall('meet_session_store', '_session_sync', [{
        session_id: sessionId, transcript_path: transcriptPath,
        min_moment_confidence: minConfidence ?? 0.7,
      }]);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:session_sync error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:session_get', async (_, { sessionId }) => {
    try {
      const result = await _pyCall('meet_session_store', '_session_get', [{ session_id: sessionId }]);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:session_get error', err); return { ok: false, error: err.message }; }
  });

  ipcMain.handle('meet:session_end', async (_, { sessionId, status, notes }) => {
    try {
      const args = [sessionId, status ?? 'done', notes ?? ''];
      const result = await _pyCall('meet_session_store', '_session_end', [args]);
      return { ok: true, data: result };
    } catch (err) { log.error('meet:session_end error', err); return { ok: false, error: err.message }; }
  });

  log.info('Meet IPC handlers registered');
}

module.exports = { registerMeetHandlers };

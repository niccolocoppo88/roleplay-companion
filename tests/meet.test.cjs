/**
 * tests/meet.test.cjs
 * Unit tests for the Meet Python wrapper integration.
 * Run with: node tests/meet.test.cjs
 *
 * These are PURE Node.js tests — no Electron needed.
 * We test the Python layer directly via child_process spawn,
 * and validate the preload/handler code by reading the source.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
const PYTHON = path.join(HERMES_HOME, 'hermes-agent', 'venv', 'bin', 'python3');
const PLUGIN_ROOT = path.join(HERMES_HOME, 'hermes-agent', 'plugins', 'google_meet');

// ─── Python call helper ────────────────────────────────────────────────────────

function pyCall(fnName, kwargs = null) {
  return new Promise((resolve, reject) => {
    const pyCode = `
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
`;
    const proc = spawn(PYTHON, ['-c', pyCode], {
      env: { ...process.env, HERMES_HOME },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0 || stderr) {
        reject(new Error(stderr || `python exit code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(new Error(`JSON parse error on: ${stdout.trim()}`));
      }
    });
    proc.on('error', reject);
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n  Meet Python Wrapper Tests\n');

  // ── Python layer: pm.status() ─────────────────────────────────────────────

  test('pm.status() returns {ok: bool, alive: bool, ...}', async () => {
    const r = await pyCall('pm.status');
    if (typeof r !== 'object') throw new Error('not an object');
    if (typeof r.ok !== 'boolean') throw new Error('ok is not boolean');
    if (typeof r.alive !== 'boolean') throw new Error('alive is not boolean');
  });

  // ── Python layer: pm.transcript() ────────────────────────────────────────

  test('pm.transcript() returns {ok, lines: list, ...}', async () => {
    const r = await pyCall('pm.transcript', null);
    if (!r.ok) throw new Error(`pm.transcript failed: ${JSON.stringify(r)}`);
    if (!Array.isArray(r.lines)) throw new Error('lines is not an array');
  });

  test('pm.transcript(last=3) returns at most 3 lines', async () => {
    const r = await pyCall('pm.transcript', { last: 3 });
    if (!Array.isArray(r.lines)) throw new Error('lines is not an array');
    if (r.lines.length > 3) throw new Error(`expected ≤3 lines, got ${r.lines.length}`);
  });

  // ── Python layer: pm.start() with invalid URL ─────────────────────────────

  test('pm.start() with non-meet URL returns ok:false', async () => {
    const r = await pyCall('pm.start', {
      url: 'https://example.com/',
      headed: false,
      guest_name: 'TestBot',
      mode: 'transcribe',
      duration: null,
    });
    // Non-meet URL should be rejected (or started but with ok:false)
    if (r.ok !== false && !r.error) throw new Error('expected ok:false or error field');
  });

  // ── Python layer: pm.enqueue_say() ───────────────────────────────────────

  test('pm.enqueue_say({text}) returns {ok}', async () => {
    const r = await pyCall('pm.enqueue_say', { text: 'hello world' });
    if (!('ok' in r)) throw new Error('result missing ok field');
  });

  // ── Python layer: pm.stop() ───────────────────────────────────────────────

  test('pm.stop() returns {ok}', async () => {
    const r = await pyCall('pm.stop', { reason: 'test-run' });
    if (!('ok' in r)) throw new Error('result missing ok field');
  });

  // ── Electron handler: preload.cjs has meet API ───────────────────────────

  test('preload.cjs exposes meet.{join,status,transcript,leave,say}', () => {
    const preload = fs.readFileSync(
      path.join(__dirname, '../electron/preload.cjs'), 'utf8'
    );
    const methods = ['join', 'status', 'transcript', 'leave', 'say'];
    for (const m of methods) {
      if (!preload.includes(m)) throw new Error(`preload missing method: ${m}`);
    }
    if (!preload.includes("contextBridge.exposeInMainWorld('meet'")) {
      throw new Error("preload does not expose 'meet' via contextBridge");
    }
  });

  // ── Electron handler: meet.cjs exports registerHandlers ─────────────────

  test('meet.cjs exports registerHandlers function', () => {
    const meetSrc = fs.readFileSync(
      path.join(__dirname, '../electron/meet.cjs'), 'utf8'
    );
    if (!meetSrc.includes('function registerHandlers')) {
      throw new Error('meet.cjs missing registerHandlers function');
    }
    if (!meetSrc.includes("ipcMain.handle('meet:join'")) {
      throw new Error('meet.cjs missing meet:join IPC handler');
    }
    if (!meetSrc.includes("ipcMain.handle('meet:leave'")) {
      throw new Error('meet.cjs missing meet:leave IPC handler');
    }
  });

  // ── Electron handler: main.cjs wires up meet ─────────────────────────────

  test('main.cjs requires and calls meet.registerHandlers()', () => {
    const mainSrc = fs.readFileSync(
      path.join(__dirname, '../electron/main.cjs'), 'utf8'
    );
    if (!mainSrc.includes("require('./meet.cjs')")) {
      throw new Error("main.cjs does not require('./meet.cjs')");
    }
    if (!mainSrc.includes('meet.registerHandlers()')) {
      throw new Error("main.cjs does not call meet.registerHandlers()");
    }
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
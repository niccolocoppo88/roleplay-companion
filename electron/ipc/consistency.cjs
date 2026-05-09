/**
 * electron/ipc/consistency.cjs
 * M5-T5: Consistency checker — IPC handler.
 * Loads the Python consistency_checker.py and exposes it to the renderer.
 */
const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const log = require('electron-log');
const path = require('path');

function getPythonPath() {
    return process.env.HERMES_AGENT_VENV_PYTHON ||
        path.join(process.env.HOME || '', '.hermes', 'venvs', 'hermes-agent', 'bin', 'python3');
}

function runPython(pythonScript, args = []) {
    return new Promise((resolve, reject) => {
        const pythonPath = getPythonPath();
        const proc = spawn(pythonPath, [pythonScript, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
        proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `python exited ${code}`));
            } else {
                resolve(stdout.trim());
            }
        });

        proc.on('error', err => reject(err));
    });
}

/**
 * Call the Python consistency checker.
 * @param {object} character - character profile dict
 * @param {string} content   - content to check
 * @returns {Promise<{ok: boolean, warnings: array}>}
 */
async function pythonCheckConsistency(character, content) {
    const pythonScript = path.join(__dirname, '..', 'python', 'generators', 'consistency_checker.py');

    // Serialize as JSON lines: first arg is character dict, second is content string
    const inputJson = JSON.stringify({ character, content });

    const result = await new Promise((resolve, reject) => {
        const pythonPath = getPythonPath();
        const proc = spawn(pythonPath, [pythonScript], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
        proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                log.warn('consistency_checker.py exited non-zero:', stderr);
                reject(new Error(stderr || `exit ${code}`));
            } else {
                resolve(stdout.trim());
            }
        });

        proc.on('error', err => reject(err));

        proc.stdin.write(inputJson);
        proc.stdin.end();
    });

    return JSON.parse(result);
}

function registerHandlers() {
    // consistency:check — check content against character profile
    ipcMain.handle('consistency:check', async (_, { character, content }) => {
        try {
            const result = await pythonCheckConsistency(character, content);
            return { ok: true, data: result };
        } catch (err) {
            log.error('consistency:check error', err);
            return { ok: false, error: err.message };
        }
    });

    // consistency:rules — list available rules (for UI to show what's checked)
    ipcMain.handle('consistency:rules', async () => {
        return {
            ok: true,
            data: [
                { name: "fears", description: "Contrast with character's fears", severity: "high" },
                { name: "catchphrase_reuse", description: "Reuse of known catchphrase", severity: "low" },
                { name: "backstory_conflict", description: "Content contradicts backstory", severity: "high" },
                { name: "goal_alignment", description: "Character abandons goals without reason", severity: "medium" },
            ],
        };
    });

    log.info('Consistency IPC handlers registered');
}

module.exports = { registerHandlers };
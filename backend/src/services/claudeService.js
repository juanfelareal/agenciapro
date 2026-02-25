import { spawn } from 'child_process';

/**
 * Call Claude via the CLI (claude -p) piping the prompt through stdin.
 * Uses the locally authenticated session — no ANTHROPIC_API_KEY needed.
 *
 * @param {string} prompt - The prompt to send to Claude
 * @param {object} [options]
 * @param {string} [options.model='sonnet'] - Model alias: 'sonnet', 'haiku', 'opus'
 * @param {number} [options.timeout=120000] - Timeout in ms
 * @returns {Promise<string>} Claude's response text
 */
export async function askClaude(prompt, { model = 'sonnet', timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    // Remove CLAUDECODE env var to avoid nested session detection
    const cleanEnv = { ...process.env, NO_COLOR: '1' };
    delete cleanEnv.CLAUDECODE;

    const child = spawn('claude', [
      '-p',
      '--model', model,
      '--no-session-persistence',
    ], {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    child.on('error', reject);

    // Send prompt via stdin and close it
    child.stdin.write(prompt);
    child.stdin.end();

    // Timeout
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude timed out after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Ask Claude and parse a JSON response.
 * Handles markdown code fences and extracts the JSON object.
 */
export async function askClaudeJSON(prompt, options = {}) {
  const text = await askClaude(prompt, options);

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error(`Could not parse Claude response as JSON: ${text.substring(0, 200)}`);
  }
}

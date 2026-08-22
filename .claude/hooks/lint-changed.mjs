#!/usr/bin/env node
/**
 * PostToolUse hook: lints a TypeScript file the moment it is written or edited, and
 * reports failures straight back to the agent.
 *
 * This is the difference between a guardrail and a gate. A gate says no at commit time,
 * by which point the agent has moved on and the correction costs a context switch. This
 * fires on the edit itself, so a banned locator or a raw HTTP call comes back within the
 * same train of thought — the agent is corrected without anyone asking it to check.
 *
 * Exit codes: 0 stays silent; 2 sends stderr to the agent as feedback it must address.
 * Anything unexpected exits 0 — a broken hook must never block work.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const LINTABLE = /\.ts$/;
const WATCHED_DIRS = /(^|\/)(tests|src|tools)\//;

function readStdin() {
  return new Promise((resolvePromise) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolvePromise(data));
    // If nothing arrives, do not hang the agent.
    setTimeout(() => resolvePromise(data), 2000);
  });
}

const raw = await readStdin();

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}

if (typeof filePath !== 'string' || !LINTABLE.test(filePath)) {
  process.exit(0);
}

const relative = filePath.startsWith(REPO_ROOT) ? filePath.slice(REPO_ROOT.length + 1) : filePath;

if (!WATCHED_DIRS.test(`/${relative}`) || !existsSync(filePath)) {
  process.exit(0);
}

const result = spawnSync('npx', ['eslint', filePath], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  timeout: 60_000,
});

if (result.status === 0 || result.error) {
  process.exit(0);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
if (output.length === 0) {
  process.exit(0);
}

process.stderr.write(
  `Guardrails rejected ${relative}:\n\n${output}\n\n` +
    `Fix these before continuing. The two that come up most:\n` +
    `  - Locators belong in src/pages/, never in a test.\n` +
    `  - HTTP belongs in src/api/, never in a test.\n` +
    `See docs/ENGINEERING_STANDARDS.md.\n`
);
process.exit(2);

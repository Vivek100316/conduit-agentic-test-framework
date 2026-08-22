/**
 * Fails loudly and actionably when the app under test is not running.
 *
 * This exists because the default failure mode — a wall of ECONNREFUSED from inside a
 * test worker — tells a contributor (human or agent) nothing about what to do next, and
 * an agent's most likely response to an unexplained red run is to start "fixing" tests
 * that were never broken.
 */
import { API_PATH, env } from '../src/config/env';

interface Target {
  name: string;
  url: string;
  remedy: string;
}

const targets: Target[] = [
  {
    name: 'Conduit API',
    url: `${env.API_BASE_URL}${API_PATH}`,
    remedy: 'nvm exec 16 node app.js',
  },
  {
    name: 'Conduit UI',
    url: env.UI_BASE_URL,
    remedy: 'cd react-redux-realworld-example-app && BROWSER=none nvm exec 16 npm start',
  },
];

async function check(target: Target): Promise<string | null> {
  try {
    const response = await fetch(target.url, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return `${target.name} answered ${response.status} at ${target.url}`;
    }
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `${target.name} is not reachable at ${target.url} (${reason})`;
  }
}

async function main(): Promise<void> {
  const failures = (await Promise.all(targets.map(check))).filter(
    (result): result is string => result !== null
  );

  if (failures.length === 0) {
    console.log('App under test is up:');
    for (const target of targets) {
      console.log(`  ${target.name}: ${target.url}`);
    }
    return;
  }

  console.error('The app under test is not ready.\n');
  for (const failure of failures) {
    console.error(`  ${failure}`);
  }
  console.error('\nStart it from the app repository:');
  for (const target of targets) {
    console.error(`  ${target.name}: ${target.remedy}`);
  }
  console.error('\nFull setup, including the Node 16 requirement: docs/APP_SETUP.md');
  process.exitCode = 1;
}

void main();

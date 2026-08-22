/**
 * Reports designed scenarios against implemented ones.
 *
 * Coverage in this repository is a computed number rather than a claim. Scenario designs
 * in docs/scenarios/ carry stable IDs; a test claims one by putting the ID in its title.
 * This script joins the two and prints the gap.
 *
 * It exits non-zero only for an *orphan* — a test claiming an ID that no design defines.
 * An unimplemented scenario is not a failure; it is a decision, and the design documents
 * say why. Failing the build for it would push contributors to delete scenarios rather
 * than record judgement about them.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const SCENARIO_DIR = join(REPO_ROOT, 'docs', 'scenarios');
const TEST_DIR = join(REPO_ROOT, 'tests');

const ID_PATTERN = /\b([A-Z][A-Z0-9]*-P[0-2]-\d{2,})\b/g;

interface DesignedScenario {
  id: string;
  priority: string;
  title: string;
  source: string;
}

function walk(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(full, suffix);
    }
    return entry.name.endsWith(suffix) ? [full] : [];
  });
}

function readDesigned(): DesignedScenario[] {
  const scenarios: DesignedScenario[] = [];

  for (const file of walk(SCENARIO_DIR, '.md')) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      // Table rows only: | ID | Scenario | Priority | ...
      if (!line.trimStart().startsWith('|')) {
        continue;
      }
      const cells = line.split('|').map((cell) => cell.trim());
      const id = cells[1];
      if (id === undefined || !/^[A-Z][A-Z0-9]*-P[0-2]-\d{2,}$/.test(id)) {
        continue;
      }
      scenarios.push({
        id,
        title: cells[2] ?? '',
        priority: cells[3] ?? id.split('-')[1] ?? '',
        source: relative(REPO_ROOT, file),
      });
    }
  }

  return scenarios;
}

function readImplemented(): Map<string, string> {
  const implemented = new Map<string, string>();

  for (const file of walk(TEST_DIR, '.spec.ts')) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(ID_PATTERN)) {
      const id = match[1];
      if (id !== undefined) {
        implemented.set(id, relative(REPO_ROOT, file));
      }
    }
  }

  return implemented;
}

function main(): void {
  const designed = readDesigned();
  const implemented = readImplemented();

  if (designed.length === 0) {
    console.error(`No scenario designs found in ${relative(REPO_ROOT, SCENARIO_DIR)}.`);
    console.error('Run the design-scenarios skill for a feature first.');
    process.exitCode = 1;
    return;
  }

  const byPriority = new Map<string, { designed: number; done: number }>();
  for (const scenario of designed) {
    const bucket = byPriority.get(scenario.priority) ?? { designed: 0, done: 0 };
    bucket.designed += 1;
    if (implemented.has(scenario.id)) {
      bucket.done += 1;
    }
    byPriority.set(scenario.priority, bucket);
  }

  console.log('Scenario coverage\n');
  console.log('  Priority   Implemented / Designed');
  for (const priority of [...byPriority.keys()].sort()) {
    const bucket = byPriority.get(priority);
    if (bucket === undefined) {
      continue;
    }
    console.log(`  ${priority.padEnd(10)} ${String(bucket.done).padStart(11)} / ${bucket.designed}`);
  }

  const doneTotal = designed.filter((scenario) => implemented.has(scenario.id)).length;
  console.log(`  ${'TOTAL'.padEnd(10)} ${String(doneTotal).padStart(11)} / ${designed.length}\n`);

  const pending = designed.filter((scenario) => !implemented.has(scenario.id));
  if (pending.length > 0) {
    console.log('Designed but not implemented (see each design\'s rationale):');
    for (const scenario of pending) {
      console.log(`  ${scenario.id.padEnd(14)} ${scenario.title}`);
    }
    console.log();
  }

  const designedIds = new Set(designed.map((scenario) => scenario.id));
  const orphans = [...implemented.entries()].filter(([id]) => !designedIds.has(id));

  if (orphans.length > 0) {
    console.error('Tests claim scenario IDs that no design defines:\n');
    for (const [id, file] of orphans) {
      console.error(`  ${id.padEnd(14)} ${file}`);
    }
    console.error(
      '\nEither add the scenario to a docs/scenarios/ design, or correct the test title.\n' +
        'An ID that exists only in a test cannot be reviewed, prioritised, or counted.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('No orphaned scenario IDs.');
}

main();

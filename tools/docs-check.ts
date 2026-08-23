/**
 * Fails when documentation refers to something that does not exist.
 *
 * Documentation rots quietly: a script gets renamed, six markdown files keep naming the old
 * one, and the first person to notice is a new contributor following the README and getting
 * "Missing script". This turns that class of rot into a build failure.
 *
 * Two checks, both cheap:
 *   1. Every `npm run <x>` named in markdown exists in package.json.
 *   2. Every relative markdown link resolves to a file that is actually there.
 *
 * It deliberately does not check prose for accuracy — nothing can. It checks the claims
 * that are mechanically checkable, which is the same principle the lint rules follow.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'playwright-report', 'test-results']);

/** `npm run foo`, `npm run foo -- args`, or `npm test`. */
const SCRIPT_PATTERN = /`npm run ([a-z][a-z0-9:-]*)/g;

/**
 * Scripts belonging to the **app under test**, not to this repository. `APP_SETUP.md`
 * explains how to start Conduit and `AI_USAGE.md` recounts doing so, and both legitimately
 * name its scripts — checking those against our package.json would be checking the wrong
 * manifest.
 *
 * Named individually rather than excluding whole files, so that a genuine typo in one of
 * *our* script names is still caught in the same document.
 */
const APP_UNDER_TEST_SCRIPTS = new Set(['build', 'front', 'back', 'dev', 'start']);
/** Markdown links to relative paths, ignoring URLs and pure anchors. */
const LINK_PATTERN = /\]\((?!https?:|#|mailto:)([^)\s]+)\)/g;

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) {
      return [];
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(full);
    }
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

interface Problem {
  file: string;
  detail: string;
}

function main(): void {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = new Set(Object.keys(packageJson.scripts ?? {}));

  const problems: Problem[] = [];

  for (const file of markdownFiles(REPO_ROOT)) {
    const contents = readFileSync(file, 'utf8');
    const shown = relative(REPO_ROOT, file);

    for (const match of contents.matchAll(SCRIPT_PATTERN)) {
      const name = match[1];
      if (name !== undefined && !scripts.has(name) && !APP_UNDER_TEST_SCRIPTS.has(name)) {
        problems.push({
          file: shown,
          detail: `names \`npm run ${name}\`, which package.json does not define`,
        });
      }
    }

    for (const match of contents.matchAll(LINK_PATTERN)) {
      const target = match[1];
      if (target === undefined) {
        continue;
      }
      const path = resolve(dirname(file), target.split('#')[0] ?? '');
      if (!existsSync(path)) {
        problems.push({ file: shown, detail: `links to ${target}, which does not exist` });
      }
    }
  }

  if (problems.length > 0) {
    console.error('Documentation refers to things that do not exist:\n');
    for (const problem of problems) {
      console.error(`  ${problem.file}\n    ${problem.detail}`);
    }
    console.error('\nFix the document, or restore what it points at.');
    process.exitCode = 1;
    return;
  }

  console.log('Docs check: every npm script and relative link referenced in markdown exists.');
}

main();

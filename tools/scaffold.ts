/**
 * Generates correctly-shaped test specs and page objects.
 *
 * Guardrails only ever say *no*. This says *yes, here* — it puts the conventions in front
 * of a contributor as working code rather than as a document they have to have read.
 * A generated file passes `npm run verify` before a single line is changed, so the first
 * feedback anyone gets is green rather than a lint wall.
 *
 *   npm run new:test -- api article-search
 *   npm run new:page -- ArticleList
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(value: string): string {
  return toKebabCase(value)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function write(path: string, contents: string): void {
  if (existsSync(path)) {
    console.error(`Refusing to overwrite ${relative(REPO_ROOT, path)}.`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  console.log(`Created ${relative(REPO_ROOT, path)}`);
}

function testTemplate(project: string, name: string): string {
  const describe = toPascalCase(name)
    .replace(/([A-Z])/g, ' $1')
    .trim();
  const isUi = project === 'ui';

  const body = isUi
    ? `  test('renders something a reader can see [REPLACE-WITH-SCENARIO-ID]', async ({
    authenticatedPage,
  }) => {
    // Page objects own every locator. A getBy* or .locator( in this file is a lint
    // error — add what you need to src/pages/ and call it from here.
    const header = new SiteHeader(authenticatedPage);

    await authenticatedPage.goto('/');

    await expect(header.newPostLink()).toBeVisible();
  });`
    : `  test('does something the app actually does [REPLACE-WITH-SCENARIO-ID]', async ({
    api,
    registeredUser,
  }) => {
    // Observe the endpoint against the running app before asserting on it.
    // docs/DEVIATIONS.md lists where this app disagrees with the RealWorld spec.
    const result = await api.currentUser(registeredUser.token);

    expect(result.username).toBe(registeredUser.username);
  });`;

  const imports = isUi
    ? `import { SiteHeader } from '../../src/pages/site-header';\nimport { test, expect } from '../../src/fixtures/test';`
    : `import { test, expect } from '../../src/fixtures/test';`;

  return `${imports}

/**
 * Replace REPLACE-WITH-SCENARIO-ID with a real ID from docs/scenarios/.
 * \`npm run scenarios:coverage\` fails on an ID that no design defines, so a placeholder
 * that never parses as an ID is deliberate — this file is green until you claim one.
 */
test.describe('${describe}', () => {
${body}
});
`;
}

function pageTemplate(name: string): string {
  const className = `${toPascalCase(name)}Page`;
  const route = toKebabCase(name);

  return `import type { Locator, Page } from '@playwright/test';

/**
 * The app has no \`data-testid\` attributes and cannot be modified, and its inputs have no
 * \`id\`, \`name\`, or \`<label>\` — \`getByLabel\` matches nothing anywhere in it. Anchor on
 * the placeholder for inputs and the accessible name for buttons and links, and derive
 * both from the running DOM rather than from memory.
 */
export class ${className} {
  private readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async goto(): Promise<void> {
    await this.page.goto('/${route}');
  }

  title(): Locator {
    return this.heading;
  }
}
`;
}

function main(): void {
  const [kind, ...args] = process.argv.slice(2);

  if (kind === 'test') {
    const [project, name] = args;
    if (project === undefined || name === undefined) {
      console.error('Usage: npm run new:test -- <api|ui> <name>');
      process.exitCode = 1;
      return;
    }
    if (project !== 'api' && project !== 'ui') {
      console.error(`Unknown project "${project}". Use "api" or "ui".`);
      process.exitCode = 1;
      return;
    }
    write(
      join(REPO_ROOT, 'tests', project, `${toKebabCase(name)}.spec.ts`),
      testTemplate(project, name)
    );
    console.log('\nNext: claim a real scenario ID, then run `npm run verify`.');
    return;
  }

  if (kind === 'page') {
    const [name] = args;
    if (name === undefined) {
      console.error('Usage: npm run new:page -- <Name>');
      process.exitCode = 1;
      return;
    }
    write(join(REPO_ROOT, 'src', 'pages', `${toKebabCase(name)}.page.ts`), pageTemplate(name));
    console.log('\nNext: verify each locator against the running app before trusting it.');
    return;
  }

  console.error('Usage:\n  npm run new:test -- <api|ui> <name>\n  npm run new:page -- <Name>');
  process.exitCode = 1;
}

main();

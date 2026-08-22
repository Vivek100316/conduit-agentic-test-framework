'use strict';

/**
 * Locators may only appear in `src/pages/`.
 *
 * The app under test has zero `data-testid` attributes, its form inputs have no `id`,
 * `name`, or `<label>`, and modifying it is out of scope. Selectors are therefore a
 * scarce, curated resource rather than something to improvise per test.
 *
 * The failure this prevents is specific and observed: asked to write a login test, a
 * coding agent will reach for `getByLabel('Password')` (verified 0 matches — the app has
 * no labels), unqualified `getByRole('textbox')` (2 matches on the login form), or
 * `.locator('.form-control')` (2 matches on login, 4 in the editor). All three are
 * plausible, idiomatic, and wrong here.
 *
 * Forcing locators into a page object does not make an agent smarter. It makes it read
 * the existing, working pattern before writing a new one.
 */

const LOCATOR_METHODS = new Set([
  'locator',
  'getByAltText',
  'getByLabel',
  'getByPlaceholder',
  'getByRole',
  'getByTestId',
  'getByText',
  'getByTitle',
  '$',
  '$$',
]);

const PAGE_OBJECT_DIR = 'src/pages/';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Playwright locators outside of page objects',
    },
    messages: {
      locatorOutsidePageObject:
        'Locator `{{method}}()` is not allowed here. Locators live only in src/pages/. ' +
        'Add or extend a page object and call its intent-named method instead ' +
        '(for example `loginPage.signIn(user)`, not `page.locator(...)`). ' +
        'See docs/ENGINEERING_STANDARDS.md.',
    },
    schema: [],
  },

  create(context) {
    const filename = (context.filename ?? context.getFilename()).split('\\').join('/');

    if (filename.includes(PAGE_OBJECT_DIR)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') {
          return;
        }

        const property = node.callee.property;
        if (property.type !== 'Identifier' || !LOCATOR_METHODS.has(property.name)) {
          return;
        }

        context.report({
          node,
          messageId: 'locatorOutsidePageObject',
          data: { method: property.name },
        });
      },
    };
  },
};

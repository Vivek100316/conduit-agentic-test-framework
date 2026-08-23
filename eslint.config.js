'use strict';

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const playwright = require('eslint-plugin-playwright');
const prettier = require('eslint-config-prettier');

const guardrails = require('./eslint-rules');

module.exports = tseslint.config(
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'blob-report/**'],
  },

  js.configs.recommended,

  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: { guardrails },
    rules: {
      'guardrails/no-locators-outside-page-objects': 'error',
      'guardrails/no-raw-http-outside-api-client': 'error',

      // Naming, per the Google TypeScript Style Guide. Both of the prohibitions below
      // are common AI output, which is why they are enforced rather than documented.
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
        },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        // No `IFoo` interface prefix.
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        // No `_private` members — use the `private` keyword.
        { selector: 'classProperty', format: ['camelCase'], leadingUnderscore: 'forbid' },
        { selector: 'classMethod', format: ['camelCase'], leadingUnderscore: 'forbid' },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'typeProperty', format: null },
        { selector: 'import', format: null },
      ],

      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  {
    files: ['tests/**/*.spec.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // Fixed sleeps have no legitimate use here. If one looks necessary, the real
      // problem is a missing observable signal — find it, or wait on the request that
      // actually gates the behaviour.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/expect-expect': 'error',
      'playwright/prefer-web-first-assertions': 'error',
    },
  },

  {
    files: ['eslint-rules/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },

  {
    // Claude Code hooks are plain ESM run by node, outside the TypeScript project.
    files: ['.claude/hooks/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },

  /**
   * Last, so it wins: turns off every ESLint rule that overlaps with Prettier.
   * Formatting is Prettier's job and correctness is ESLint's, and a repository where the
   * two disagree teaches contributors to ignore both.
   */
  prettier
);

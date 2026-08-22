import { defineConfig } from '@playwright/test';

import { env } from './src/config/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),

  /**
   * Zero retries on purpose. A retry turns a flaky test into a green one and removes
   * the pressure to fix it; this framework's answer to flake is unique-per-test data
   * and auto-retrying assertions, not a second attempt.
   */
  retries: 0,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    /** Traces on failure so a failing run is diagnosable without reproducing it. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.API_BASE_URL },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { baseURL: env.UI_BASE_URL },
    },
  ],
});

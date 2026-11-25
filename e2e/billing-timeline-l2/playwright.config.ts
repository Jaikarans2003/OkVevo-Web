/**
 * Billing timeline Layer 2. env.ts fails closed if RAZORPAY_KEY_ID is not
 * rzp_test_*. No webServer: point L2_BASE_URL at an already-running app.
 *
 * `setup` signs in the dashboard roles. `dashboard` depends on it.
 * `staging` is the existing fetch-only specs and does not use storageState.
 */
import { defineConfig } from '@playwright/test';
import { L2_ENV } from './env';

export default defineConfig({
  testDir: '.',
  timeout: 600_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: L2_ENV.baseUrl,
    navigationTimeout: 90_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'dashboard',
      testMatch: /dashboard\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'staging',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /dashboard\.spec\.ts/,
    },
  ],
});

/**
 * Billing timeline Layer 2 (plan §14.3). Staging only — env.ts fails closed
 * if RAZORPAY_KEY_ID is not rzp_test_*. No `webServer`: this always drives
 * a real deployed staging origin, never a local dev server.
 */
import { defineConfig } from '@playwright/test';
import './env'; // fails closed before Playwright even collects tests

export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

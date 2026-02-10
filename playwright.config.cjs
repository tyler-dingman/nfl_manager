const { devices } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests/mobile',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
};

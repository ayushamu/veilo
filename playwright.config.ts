import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying a failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    
    /* Take screenshots on failure for visual debugging */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers and mobile emulation */
  projects: [
    {
      name: 'android-chrome',
      use: { 
        ...devices['Pixel 7'],
        // Ensure a mobile viewport size
        viewport: { width: 412, height: 915 },
        // Emulate dark mode to match Veilo premium design aesthetics
        colorScheme: 'dark',
      },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'VEILO_E2E_AUTH_ENABLED=true NEXT_PUBLIC_VEILO_E2E_AUTH_ENABLED=true VEILO_E2E_AUTH_SECRET=veilo-local-e2e-secret npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});

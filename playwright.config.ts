/// Playwright configuration for browser E2E smoke tests against the built Nitro server.
import { defineConfig } from '@playwright/test';

const port = Number(process.env.NEKOGIT_E2E_PORT || 41740);
const baseURL = `http://127.0.0.1:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
const sessionPassword = '0123456789abcdef0123456789abcdef';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    headless: true,
    // Use the system Chrome by default; `executablePath` overrides it for custom installs.
    channel: executablePath ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `${baseURL}/api/auth/providers`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NUXT_SESSION_PASSWORD: sessionPassword,
      NUXT_AUTH_PAT_ENABLED: 'true',
      NUXT_AUTH_GITHUB_OAUTH_ENABLED: 'false',
      NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE: 'false',
    },
  },
});

#!/usr/bin/env node
/// Launches the built Tauri desktop client under a virtual display and verifies the landing page renders.
/// Prerequisites: `pnpm build`, `cargo build --manifest-path src-tauri/Cargo.toml`,
/// `cargo install tauri-driver`, `WebKitWebDriver`, and `xvfb-run` on Linux.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = resolve(import.meta.dirname, '..');
const port = Number(process.env.NEKOGIT_DESKTOP_SMOKE_PORT || 41741);
const driverPort = Number(process.env.NEKOGIT_DESKTOP_DRIVER_PORT || 4444);
const nativePort = Number(process.env.NEKOGIT_DESKTOP_NATIVE_PORT || 4445);
const baseUrl = `http://127.0.0.1:${port}`;
const binaryPath = resolve(
  repoRoot,
  process.env.NEKOGIT_DESKTOP_BINARY || 'src-tauri/target/debug/nekogit-client'
);
const sessionPassword = '0123456789abcdef0123456789abcdef';
const tauriDriver =
  process.env.NEKOGIT_TAURI_DRIVER || resolve(homedir(), '.cargo/bin/tauri-driver');
const nativeDriver = process.env.NEKOGIT_WEBKIT_DRIVER || '/usr/bin/WebKitWebDriver';

if (!existsSync(binaryPath)) {
  throw new Error(`Desktop binary not found at ${binaryPath}. Run cargo build first.`);
}
if (!existsSync(tauriDriver)) {
  throw new Error(`tauri-driver not found at ${tauriDriver}. Run cargo install tauri-driver.`);
}

let serverOutput = '';
let driverOutput = '';
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    NUXT_SESSION_PASSWORD: sessionPassword,
    NUXT_AUTH_PAT_ENABLED: 'true',
    NUXT_AUTH_GITHUB_OAUTH_ENABLED: 'false',
    NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

const driverArgs = [
  '-a',
  tauriDriver,
  '--port',
  String(driverPort),
  '--native-port',
  String(nativePort),
];
if (existsSync(nativeDriver)) {
  driverArgs.push('--native-driver', nativeDriver);
}
const driver = spawn('xvfb-run', driverArgs, {
  cwd: repoRoot,
  env: {
    ...process.env,
    NEKOGIT_CLIENT_URL: baseUrl,
    WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS: '1',
    WEBKIT_DISABLE_COMPOSITING_MODE: '1',
    LIBGL_ALWAYS_SOFTWARE: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
driver.stdout.on('data', (chunk) => {
  driverOutput += chunk.toString();
});
driver.stderr.on('data', (chunk) => {
  driverOutput += chunk.toString();
});

const request = async (url, init = {}, timeout = 10_000) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });

const waitFor = async (url, attempts = 60) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request(url, {}, 1000);
      if (response.ok) return response;
    } catch {
      // Server or driver is still starting.
    }
    await delay(250);
  }
  throw new Error(
    `Timed out waiting for ${url}.\nServer:\n${serverOutput.slice(-3000)}\nDriver:\n${driverOutput.slice(-3000)}`
  );
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const watchdog = setTimeout(() => {
  console.error('Desktop smoke timed out.');
  process.exitCode = 1;
  cleanup();
}, 240_000);
watchdog.unref();

let sessionId = '';
const cleanup = () => {
  if (sessionId) {
    void request(
      `http://127.0.0.1:${driverPort}/session/${sessionId}`,
      { method: 'DELETE' },
      3000
    ).catch(() => {});
  }
  try {
    process.kill(-driver.pid, 'SIGTERM');
  } catch {
    // Driver already exited.
  }
  server.kill('SIGTERM');
  setTimeout(() => {
    try {
      process.kill(-driver.pid, 'SIGKILL');
    } catch {
      // Driver already exited.
    }
    server.kill('SIGKILL');
  }, 1000).unref();
};

try {
  await waitFor(`${baseUrl}/api/auth/providers`);
  console.error('Desktop smoke: server ready');
  await waitFor(`http://127.0.0.1:${driverPort}/status`);
  console.error('Desktop smoke: WebDriver ready');

  const createResponse = await request(
    `http://127.0.0.1:${driverPort}/session`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            browserName: 'wry',
            'tauri:options': { application: binaryPath },
          },
        },
      }),
    },
    120_000
  );
  const createBody = await createResponse.json();
  assert(createResponse.ok, `Failed to create WebDriver session: ${JSON.stringify(createBody)}`);
  sessionId = createBody.value.sessionId;
  console.error('Desktop smoke: session created');

  const navigateResponse = await request(
    `http://127.0.0.1:${driverPort}/session/${sessionId}/url`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `${baseUrl}/` }),
    },
    30_000
  );
  assert(
    navigateResponse.ok,
    `Failed to navigate the desktop webview (${navigateResponse.status})`
  );

  await delay(2000);

  const elementResponse = await request(
    `http://127.0.0.1:${driverPort}/session/${sessionId}/element`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ using: 'css selector', value: 'h1' }),
    }
  );
  const elementBody = await elementResponse.json();
  assert(elementResponse.ok, `Landing heading not found: ${JSON.stringify(elementBody)}`);

  const elementId = elementBody.value?.['element-6066-11e4-a52e-4f735466cecf'];
  const textResponse = await request(
    `http://127.0.0.1:${driverPort}/session/${sessionId}/element/${elementId}/text`
  );
  const textBody = await textResponse.json();
  assert(textBody.value === 'NekoGit', `Unexpected landing heading: ${JSON.stringify(textBody)}`);

  const sourceResponse = await request(
    `http://127.0.0.1:${driverPort}/session/${sessionId}/source`
  );
  const sourceBody = await sourceResponse.json();
  assert(
    typeof sourceBody.value === 'string' && sourceBody.value.includes('NekoGit'),
    'Desktop page source does not include NekoGit'
  );

  console.log('Desktop smoke passed: Tauri webview rendered the landing page.');
} catch (error) {
  console.error(error);
  console.error(`Driver output:\n${driverOutput.slice(-4000)}`);
  console.error(`Server output:\n${serverOutput.slice(-2000)}`);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  cleanup();
}

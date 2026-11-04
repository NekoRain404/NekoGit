#!/usr/bin/env node
/// Starts the built Nitro server and verifies baseline auth, CSRF, and security headers.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = resolve(import.meta.dirname, '..');
const port = Number(process.env.NEKOGIT_SMOKE_PORT || 41739);
const baseUrl = `http://127.0.0.1:${port}`;
const sessionPassword = '0123456789abcdef0123456789abcdef';
const serverEntry = resolve(repoRoot, '.output/server/index.mjs');

const child = spawn(process.execPath, [serverEntry], {
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

let serverOutput = '';
child.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/providers`);
      if (response.ok) return response;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Server did not start.\n${serverOutput.slice(-4000)}`);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const getCsrfCookie = (response) => {
  const cookies = response.headers.getSetCookie?.() ?? [];
  const csrf = cookies.find((cookie) => cookie.startsWith('nekogit_csrf='));
  return csrf?.split(';')[0]?.split('=')[1] ?? '';
};

try {
  const providersResponse = await waitForServer();
  const csrfToken = getCsrfCookie(providersResponse);

  assert(csrfToken.length > 20, 'Expected a seeded CSRF cookie');
  assert(
    providersResponse.headers.get('x-content-type-options') === 'nosniff',
    'Expected X-Content-Type-Options: nosniff'
  );
  assert(
    providersResponse.headers.get('x-frame-options') === 'DENY',
    'Expected X-Frame-Options: DENY'
  );

  const unauthorized = await fetch(`${baseUrl}/api/user`);
  assert(unauthorized.status === 401, `Expected /api/user to be 401, got ${unauthorized.status}`);

  const unauthorizedRepoUpdate = await fetch(`${baseUrl}/api/repos/nekogit-smoke/repository`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: baseUrl,
      cookie: `nekogit_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ description: 'smoke' }),
  });
  assert(
    unauthorizedRepoUpdate.status === 401,
    `Expected repository PATCH to be 401, got ${unauthorizedRepoUpdate.status}`
  );

  const unauthorizedRepoDelete = await fetch(`${baseUrl}/api/repos/nekogit-smoke/repository`, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      origin: baseUrl,
      cookie: `nekogit_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ confirmName: 'repository' }),
  });
  assert(
    unauthorizedRepoDelete.status === 401,
    `Expected repository DELETE to be 401, got ${unauthorizedRepoDelete.status}`
  );

  const missingCsrf = await fetch(`${baseUrl}/auth/pat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify({ token: 'invalid' }),
  });
  assert(missingCsrf.status === 403, `Expected missing CSRF to be 403, got ${missingCsrf.status}`);

  const emptyToken = await fetch(`${baseUrl}/auth/pat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: baseUrl,
      cookie: `nekogit_csrf=${csrfToken}`,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ token: '' }),
  });
  assert(
    emptyToken.status === 400,
    `Expected empty token with CSRF to be 400, got ${emptyToken.status}`
  );

  console.log(`Server smoke passed on ${baseUrl}.`);
} finally {
  child.kill('SIGTERM');
  await delay(1000);
  if (!child.killed) child.kill('SIGKILL');
}

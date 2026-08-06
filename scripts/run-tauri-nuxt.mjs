/// Runs the Nuxt server for Tauri: ensures a persistent session password and spawns the app with desktop-friendly defaults.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sessionSecretPath = resolve(repoRoot, '.data/tauri-session.secret');
const minSessionPasswordLength = 32;

const defaultEnvironment = {
  NUXT_AUTH_PERSONAL_MODE_ENABLED: 'false',
  NUXT_AUTH_GITHUB_OAUTH_ENABLED: 'false',
  NUXT_AUTH_PAT_ENABLED: 'true',
  NUXT_NEKOGIT_AUTH_SESSION_COOKIE_SECURE: 'false',
};

function isValidSessionPassword(value) {
  return typeof value === 'string' && value.trim().length >= minSessionPasswordLength;
}

async function ensureSessionPassword() {
  if (isValidSessionPassword(process.env.NUXT_SESSION_PASSWORD)) {
    process.env.NUXT_SESSION_PASSWORD = process.env.NUXT_SESSION_PASSWORD.trim();
    return;
  }

  if (existsSync(sessionSecretPath)) {
    const existingSecret = (await readFile(sessionSecretPath, 'utf8')).trim();
    if (isValidSessionPassword(existingSecret)) {
      process.env.NUXT_SESSION_PASSWORD = existingSecret;
      return;
    }
  }

  const generatedSecret = randomBytes(32).toString('hex');
  await mkdir(dirname(sessionSecretPath), { recursive: true });
  await writeFile(sessionSecretPath, `${generatedSecret}\n`, { mode: 0o600 });
  process.env.NUXT_SESSION_PASSWORD = generatedSecret;
}

function applyDesktopAuthDefaults() {
  for (const [name, value] of Object.entries(defaultEnvironment)) {
    process.env[name] ||= value;
  }
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });

    const forwardSigint = () => child.kill('SIGINT');
    const forwardSigterm = () => child.kill('SIGTERM');

    process.once('SIGINT', forwardSigint);
    process.once('SIGTERM', forwardSigterm);

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', forwardSigint);
      process.removeListener('SIGTERM', forwardSigterm);

      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited from ${signal}`));
        return;
      }

      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  const mode = process.argv[2];
  await ensureSessionPassword();
  applyDesktopAuthDefaults();

  switch (mode) {
    case 'build':
      await run('pnpm', ['exec', 'nuxt', 'build']);
      await run('pnpm', ['client:prepare-output']);
      await run('pnpm', ['client:prepare-node']);
      break;
    case 'dev':
      await run('pnpm', ['dev', '--host', '127.0.0.1', '--port', '3000']);
      break;
    default:
      throw new Error('Usage: node scripts/run-tauri-nuxt.mjs <build|dev>');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(repoRoot, '.node-runtime');
const cacheRoot = resolve(repoRoot, '.cache/tauri-node-runtime');
const platform = 'linux';
const arch = 'x64';
const runtimeDir = resolve(runtimeRoot, `${platform}-${arch}`);
const nodeBinary = resolve(runtimeDir, 'bin/node');
const versionFile = resolve(runtimeDir, 'VERSION');
const defaultMirror = 'https://npmmirror.com/mirrors/node';

function normalizeNodeVersion(value) {
  const version = value.trim();
  return version.startsWith('v') ? version : `v${version}`;
}

function download(url, destination, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error(`Too many redirects while downloading ${url}`);
  }

  return new Promise((resolvePromise, reject) => {
    const request = get(url, (response) => {
      const statusCode = response.statusCode ?? 0;

      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        response.resume();
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error(`Download redirected without a Location header: ${url}`));
          return;
        }

        resolvePromise(
          download(new URL(redirectUrl, url).toString(), destination, redirectCount + 1)
        );
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${statusCode}: ${url}`));
        return;
      }

      const file = createWriteStream(destination);
      response.pipe(file);
      file.once('finish', () => {
        file.close(resolvePromise);
      });
      file.once('error', reject);
    });

    request.once('error', reject);
  });
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
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

async function runtimeIsReady(version) {
  try {
    const existingVersion = (await readFile(versionFile, 'utf8')).trim();
    return existingVersion === version;
  } catch {
    return false;
  }
}

async function main() {
  if (process.platform !== platform || process.arch !== arch) {
    throw new Error(
      `NekoGit currently bundles a ${platform}-${arch} Node runtime, but this build host is ${process.platform}-${process.arch}.`
    );
  }

  const version = normalizeNodeVersion(
    process.env.NEKOGIT_NODE_RUNTIME_VERSION || process.versions.node
  );
  const mirror = (process.env.NEKOGIT_NODE_RUNTIME_MIRROR || defaultMirror).replace(/\/$/, '');
  const archiveName = `node-${version}-${platform}-${arch}.tar.xz`;
  const archivePath = resolve(cacheRoot, archiveName);
  const extractDir = resolve(cacheRoot, `node-${version}-${platform}-${arch}`);
  const archiveUrl = `${mirror}/${version}/${archiveName}`;

  if (await runtimeIsReady(version)) {
    await chmod(nodeBinary, 0o755);
    console.log(`Using existing bundled Node runtime ${version}.`);
    return;
  }

  await mkdir(cacheRoot, { recursive: true });
  await rm(extractDir, { recursive: true, force: true });
  await download(archiveUrl, archivePath);
  await mkdir(extractDir, { recursive: true });
  await run('tar', ['-xJf', archivePath, '-C', extractDir, '--strip-components=1']);

  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(resolve(runtimeDir, 'bin'), { recursive: true });
  await copyFile(resolve(extractDir, 'bin/node'), nodeBinary);
  await chmod(nodeBinary, 0o755);
  await writeFile(versionFile, `${version}\n`);

  console.log(`Prepared bundled Node runtime ${version} from ${archiveUrl}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

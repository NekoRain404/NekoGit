/// Downloads and stages the standalone Node.js runtime for Tauri builds into .node-runtime.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
const checksumFileName = 'SHASUMS256.txt';

function normalizeNodeVersion(value) {
  const version = value.trim();
  return version.startsWith('v') ? version : `v${version}`;
}

function download(url, destination, redirectCount = 0, timeoutMs = 300_000) {
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
          download(new URL(redirectUrl, url).toString(), destination, redirectCount + 1, timeoutMs)
        );
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${statusCode}: ${url}`));
        return;
      }

      const expectedBytes = Number(response.headers['content-length'] ?? 0);
      let receivedBytes = 0;
      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
      });

      const file = createWriteStream(destination);
      response.pipe(file);
      response.once('error', reject);
      file.once('finish', () => {
        file.close(() => {
          if (expectedBytes > 0 && receivedBytes !== expectedBytes) {
            reject(
              new Error(
                `Incomplete download from ${url}: expected ${expectedBytes} bytes, received ${receivedBytes}.`
              )
            );
            return;
          }
          resolvePromise();
        });
      });
      file.once('error', reject);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Download timed out after ${timeoutMs}ms: ${url}`));
    });
    request.once('error', reject);
  });
}

function computeFileSha256(filePath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.once('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('end', () => resolvePromise(hash.digest('hex')));
  });
}

/** Find the expected SHA-256 hash for an archive in a SHASUMS256.txt payload. */
function findExpectedArchiveSha256(checksumContents, archiveName) {
  for (const line of checksumContents.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!match) {
      continue;
    }

    const [, hash, fileName] = match;
    if (fileName.trim().split(/[\\/]/).pop() === archiveName) {
      return hash.toLowerCase();
    }
  }

  return null;
}

async function verifyArchiveChecksum({ mirror, version, archiveName, archivePath, archiveUrl }) {
  if (process.env.NEKOGIT_NODE_RUNTIME_SKIP_CHECKSUM === '1') {
    console.warn(
      `[node-runtime] WARNING: skipping SHA-256 verification for ${archiveName} because NEKOGIT_NODE_RUNTIME_SKIP_CHECKSUM=1.`
    );
    return;
  }

  const checksumPath = resolve(cacheRoot, `${checksumFileName}.${version}`);
  const checksumUrls = [
    process.env.NEKOGIT_NODE_RUNTIME_CHECKSUM_URL,
    `${mirror}/${version}/${checksumFileName}`,
    `https://nodejs.org/dist/${version}/${checksumFileName}`,
  ].filter((value) => typeof value === 'string' && value.length > 0);
  let checksumContents = null;
  let checksumError = null;

  if (existsSync(checksumPath)) {
    const cachedChecksum = await readFile(checksumPath, 'utf8');
    if (findExpectedArchiveSha256(cachedChecksum, archiveName)) {
      checksumContents = cachedChecksum;
    }
  }

  for (const checksumUrl of checksumContents ? [] : checksumUrls) {
    try {
      await download(checksumUrl, checksumPath, 0, 30_000);
      checksumContents = await readFile(checksumPath, 'utf8');
      break;
    } catch (error) {
      checksumError = error;
    }
  }

  if (checksumContents === null) {
    throw new Error(
      `Could not download ${checksumFileName} for ${version} from ${checksumUrls.join(' or ')}. ` +
        `Refusing to use an unverified Node runtime. ${checksumError instanceof Error ? checksumError.message : ''}`.trim()
    );
  }

  const expectedSha256 = findExpectedArchiveSha256(checksumContents, archiveName);

  if (!expectedSha256) {
    throw new Error(
      `Could not find a SHA-256 checksum for ${archiveName} in the downloaded ${checksumFileName}. Refusing to use an unverified Node runtime.`
    );
  }

  const actualSha256 = await computeFileSha256(archivePath);
  if (actualSha256 !== expectedSha256) {
    await rm(archivePath, { force: true });
    throw new Error(
      `SHA-256 mismatch for ${archiveUrl}: expected ${expectedSha256}, got ${actualSha256}. ` +
        'The downloaded Node runtime was discarded. If you are using a trusted offline mirror without checksums, set NEKOGIT_NODE_RUNTIME_SKIP_CHECKSUM=1 explicitly.'
    );
  }

  console.log(`Verified ${archiveName} SHA-256: ${actualSha256}`);
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
    const [existingVersion, binaryStats] = await Promise.all([
      readFile(versionFile, 'utf8'),
      stat(nodeBinary),
    ]);
    return existingVersion.trim() === version && binaryStats.isFile() && binaryStats.size > 0;
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

  let archiveReady = false;
  if (existsSync(archivePath)) {
    try {
      await verifyArchiveChecksum({
        mirror,
        version,
        archiveName,
        archivePath,
        archiveUrl,
      });
      archiveReady = true;
      console.log(`Using cached ${archiveName}.`);
    } catch {
      console.warn(`Cached ${archiveName} failed verification; downloading it again.`);
    }
  }

  if (!archiveReady) {
    await download(archiveUrl, archivePath);
    await verifyArchiveChecksum({
      mirror,
      version,
      archiveName,
      archivePath,
      archiveUrl,
    });
  }
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

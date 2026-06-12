import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = resolve(repoRoot, 'release');
const tauriReleaseDir = resolve(repoRoot, 'src-tauri/target/release');
const tauriConfigPath = resolve(repoRoot, 'src-tauri/tauri.conf.json');
const arch = 'amd64';
const portableDirName = 'nekogit-linux-portable';

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

async function assertExists(path, label) {
  try {
    await stat(path);
  } catch {
    throw new Error(`${label} was not found at ${path}. Run pnpm client:build first.`);
  }
}

async function sha256(path) {
  const hash = createHash('sha256');
  const stream = createReadStream(path);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

async function readTauriReleaseMetadata() {
  const config = JSON.parse(await readFile(tauriConfigPath, 'utf8'));
  const productName = config.productName;
  const version = config.version;

  if (typeof productName !== 'string' || !productName.trim()) {
    throw new Error(`Missing productName in ${tauriConfigPath}`);
  }

  if (typeof version !== 'string' || !version.trim()) {
    throw new Error(`Missing version in ${tauriConfigPath}`);
  }

  return {
    productName: productName.trim(),
    version: version.trim(),
  };
}

function createRequiredPaths(metadata) {
  return {
    deb: resolve(
      tauriReleaseDir,
      `bundle/deb/${metadata.productName}_${metadata.version}_${arch}.deb`
    ),
    binary: resolve(tauriReleaseDir, 'nekogit-client'),
    output: resolve(tauriReleaseDir, '.output'),
    nodeRuntime: resolve(tauriReleaseDir, '.node-runtime'),
  };
}

async function writeReleaseReadme(metadata, entries) {
  const content = `# ${metadata.productName} Linux Preview

This directory contains the current Linux preview build.

## Files

- \`${entries.deb.name}\`: complete Debian/Ubuntu package.
- \`${portableDirName}/\`: portable directory with the Tauri binary, bundled Node runtime,
  and Nitro server output.
- \`${entries.portableArchive.name}\`: compressed copy of the portable directory.

## Recommended Install

\`\`\`bash
sudo apt install ./release/${entries.deb.name}
nekogit-client
\`\`\`

If \`apt\` reports missing dependencies, run the same command again after updating
package metadata:

\`\`\`bash
sudo apt update
sudo apt install ./release/${entries.deb.name}
\`\`\`

## Portable Run

\`\`\`bash
./release/${portableDirName}/nekogit-client
\`\`\`

The portable directory must keep \`.output/\` and \`.node-runtime/\` next to
\`nekogit-client\`.

## Checksums

\`\`\`text
${entries.deb.hash}  ${entries.deb.name}
${entries.portableArchive.hash}  ${entries.portableArchive.name}
${entries.portableBinary.hash}  ${portableDirName}/nekogit-client
\`\`\`

## Current Fixes

- PAT login uses the shared CSRF-aware fetch path.
- The desktop HTTP server does not mark the CSRF cookie as \`Secure\`, so local
  \`http://127.0.0.1:*\` packaged builds can submit token login forms correctly.

## Security Note

Do not store GitHub PATs in this directory or commit them to the repository.
Tokens should be entered in the app UI or loaded from \`gh auth token\`.
`;

  await writeFile(resolve(releaseDir, 'README.md'), content);
}

async function main() {
  const metadata = await readTauriReleaseMetadata();
  const requiredPaths = createRequiredPaths(metadata);

  await Promise.all([
    assertExists(requiredPaths.deb, 'Linux Debian package'),
    assertExists(requiredPaths.binary, 'Tauri release binary'),
    assertExists(requiredPaths.output, 'Bundled Nitro output'),
    assertExists(requiredPaths.nodeRuntime, 'Bundled Node runtime'),
  ]);

  const debName = `${metadata.productName}_${metadata.version}_${arch}.deb`;
  const portableArchiveName = `${metadata.productName}_${metadata.version}_linux-x64_portable.tar.gz`;
  const portableDir = resolve(releaseDir, portableDirName);
  const portableBinary = resolve(portableDir, 'nekogit-client');
  const debDestination = resolve(releaseDir, debName);
  const portableArchive = resolve(releaseDir, portableArchiveName);

  await mkdir(releaseDir, { recursive: true });
  await rm(portableDir, { recursive: true, force: true });
  await rm(portableArchive, { force: true });

  await mkdir(portableDir, { recursive: true });
  await copyFile(requiredPaths.binary, portableBinary);
  await chmod(portableBinary, 0o755);
  await cp(requiredPaths.output, resolve(portableDir, '.output'), { recursive: true });
  await cp(requiredPaths.nodeRuntime, resolve(portableDir, '.node-runtime'), { recursive: true });
  await copyFile(requiredPaths.deb, debDestination);

  await run('tar', [
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-C',
    releaseDir,
    '-czf',
    portableArchive,
    portableDirName,
  ]);

  const entries = {
    deb: {
      name: debName,
      hash: await sha256(debDestination),
    },
    portableArchive: {
      name: portableArchiveName,
      hash: await sha256(portableArchive),
    },
    portableBinary: {
      hash: await sha256(portableBinary),
    },
  };

  await writeReleaseReadme(metadata, entries);

  console.log(`Packaged Linux release in ${releaseDir}`);
  console.log(`${entries.deb.hash}  ${entries.deb.name}`);
  console.log(`${entries.portableArchive.hash}  ${entries.portableArchive.name}`);
  console.log(`${entries.portableBinary.hash}  ${portableDirName}/nekogit-client`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

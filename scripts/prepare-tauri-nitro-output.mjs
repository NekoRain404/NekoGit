/// Prepares the Nitro server output for Tauri packaging by materializing symlinked node_modules entries.
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModulesDir = resolve(repoRoot, '.output/server/node_modules');

function copyTarget(source, destination) {
  const sourceStats = statSync(source);

  rmSync(destination, { recursive: true, force: true });

  if (sourceStats.isDirectory()) {
    cpSync(source, destination, { recursive: true, dereference: true });
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { dereference: true });
}

function materializeSymlinks(directory) {
  let materializedCount = 0;

  for (const name of readdirSync(directory)) {
    const entry = resolve(directory, name);
    const entryStats = lstatSync(entry);

    if (entryStats.isSymbolicLink()) {
      const target = resolve(dirname(entry), readlinkSync(entry));

      if (!existsSync(target)) {
        throw new Error(`Nitro output symlink target does not exist: ${entry} -> ${target}`);
      }

      copyTarget(target, entry);
      materializedCount += 1;
      continue;
    }

    if (entryStats.isDirectory()) {
      materializedCount += materializeSymlinks(entry);
    }
  }

  return materializedCount;
}

if (!existsSync(nodeModulesDir)) {
  throw new Error(`Nitro server node_modules directory was not found: ${nodeModulesDir}`);
}

const materializedCount = materializeSymlinks(nodeModulesDir);
const suffix = materializedCount === 1 ? '' : 's';

console.log(
  `Materialized ${materializedCount} Nitro server node_modules symlink${suffix} for Tauri resources.`
);

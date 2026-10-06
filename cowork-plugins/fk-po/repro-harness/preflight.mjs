// Catch an install that belongs to a different machine before it fails deep
// inside a native module.
//
// /workspace inside the sandbox container IS the Mac's own FlowKeeper
// directory, mounted. So the container and the Mac share one node_modules, and
// npm ci on either replaces the other's native binaries: @remotion/compositor,
// @rspack/binding and esbuild all ship per-platform packages. Whoever installed
// last wins, and the loser gets "Cannot find module ..." from inside a binding
// file, which reads like a broken dependency rather than like the wrong
// platform.
//
// Measured 2026-08-29: a render in the container died on @rspack/binding
// because the tree had been installed on macOS. The PO hit the mirror image of
// this and reported it as "the harness was installed for Linux".
import { existsSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Exits with a readable message when node_modules was installed for a different
 * platform, or is missing altogether.
 *
 * The check reads the @remotion/compositor package actually on disk rather than
 * predicting its name: the linux ones carry a libc suffix (-gnu, -musl) that
 * darwin and win32 do not, so composing the expected name is its own bug.
 *
 * @param {string} tag - log prefix of the calling script
 */
export function assertInstallMatchesPlatform(tag, { platform = process.platform, root = here } = {}) {
  if (!existsSync(join(root, 'node_modules'))) {
    console.error(`[${tag}] node_modules is missing. Run: npm run setup`);
    process.exit(1);
  }

  const compositors = globSync('node_modules/@remotion/compositor-*', { cwd: root });
  // No compositor at all means an install too old or too partial to judge;
  // leave it to the renderer to complain about what it actually needs.
  if (compositors.length === 0) return;
  if (compositors.some((name) => name.includes(platform))) return;

  const installedFor = compositors[0].replace('node_modules/@remotion/compositor-', '');
  console.error(`[${tag}] node_modules was installed for ${installedFor}, but this is ${platform}.`);
  console.error(`[${tag}] Run: npm run setup`);
  console.error(
    `[${tag}] Note the sandbox container and the Mac share this directory, so that install`,
  );
  console.error(`[${tag}] replaces the other machine's binaries and it has to be re-run there.`);
  process.exit(1);
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertInstallMatchesPlatform } from './preflight.mjs';

function treeInstalledFor(compositor) {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'));
  mkdirSync(join(root, 'node_modules/@remotion', `compositor-${compositor}`), { recursive: true });
  return root;
}

test('a matching install passes', () => {
  const root = treeInstalledFor('linux-arm64-gnu');
  assert.doesNotThrow(() => assertInstallMatchesPlatform('t', { platform: 'linux', root }));
});

test('a libc suffix does not break the match', () => {
  // The whole reason the check reads the name off disk instead of composing it.
  const root = treeInstalledFor('linux-x64-musl');
  assert.doesNotThrow(() => assertInstallMatchesPlatform('t', { platform: 'linux', root }));
});

test('an install with no compositor is left to the renderer to complain about', () => {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'));
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  assert.doesNotThrow(() => assertInstallMatchesPlatform('t', { platform: 'linux', root }));
});

// The failing paths exit the process, so they run in a child.
function runInChild(body) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', body], { encoding: 'utf8' });
}

test('a mismatched install exits 1 and names both platforms', () => {
  const root = treeInstalledFor('darwin-arm64');
  const result = runInChild(`
    import { assertInstallMatchesPlatform } from ${JSON.stringify(new URL('./preflight.mjs', import.meta.url).href)};
    assertInstallMatchesPlatform('t', { platform: 'linux', root: ${JSON.stringify(root)} });
  `);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /darwin-arm64/);
  assert.match(result.stderr, /linux/);
  assert.match(result.stderr, /npm run setup/);
});

test('a missing node_modules exits 1 and says what to run', () => {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'));
  const result = runInChild(`
    import { assertInstallMatchesPlatform } from ${JSON.stringify(new URL('./preflight.mjs', import.meta.url).href)};
    assertInstallMatchesPlatform('t', { platform: 'linux', root: ${JSON.stringify(root)} });
  `);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /node_modules is missing/);
  assert.match(result.stderr, /npm run setup/);
});

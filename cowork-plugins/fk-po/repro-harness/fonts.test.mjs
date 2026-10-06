import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, 'remotion', f), 'utf8');

// The compositions declare their weights inline. Deriving the list from them,
// rather than keeping a second copy here, is the point: a weight that fonts.ts
// does not load falls back to a system font with no error anywhere, so the only
// safe check is one that cannot go stale when someone adds a heading.
function weightsUsedIn(source) {
  return new Set([...source.matchAll(/fontWeight[:=]\s*\{?\s*(\d{3})/g)].map((m) => m[1]));
}

function loadedWeights() {
  const source = read('fonts.ts');
  const list = source.match(/const WEIGHTS = \[([^\]]+)\]/);
  assert.ok(list, 'fonts.ts should declare a WEIGHTS array');
  return new Set([...list[1].matchAll(/'(\d{3})'/g)].map((m) => m[1]));
}

test('every weight the compositions render is one fonts.ts loads', () => {
  const loaded = loadedWeights();
  const used = new Set([...weightsUsedIn(read('HelpVideo.tsx')), ...weightsUsedIn(read('Cards.tsx'))]);
  assert.ok(used.size > 0, 'the regex should find the weights that are there');

  const missing = [...used].filter((w) => !loaded.has(w));
  assert.deepEqual(missing, [], `these weights would silently fall back to a system font: ${missing}`);
});

test('400 is loaded even though nothing sets it explicitly', () => {
  // Unstyled text renders at 400, so dropping it because no fontWeight names it
  // is exactly the mistake this list exists to prevent.
  assert.ok(loadedWeights().has('400'));
});

test('both compositions take their fonts from the one module', () => {
  // Two independent loadFont() calls can drift into asking for different
  // variant sets, which is how the unbounded load survived this long.
  for (const file of ['HelpVideo.tsx', 'Cards.tsx']) {
    const source = read(file);
    assert.match(source, /from '\.\/fonts'/, `${file} should import the shared fonts module`);
    assert.doesNotMatch(source, /@remotion\/google-fonts/, `${file} should not load a font itself`);
  }
});

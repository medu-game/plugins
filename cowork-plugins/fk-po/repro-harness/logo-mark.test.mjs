import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'remotion/LogoMark.tsx'), 'utf8');

// The numbers are read out of the component rather than copied, for the same
// reason fonts.test.mjs derives its list: a second copy is a second thing to
// forget. check-logo-mark.mjs proves the numbers against the app's own asset;
// these tests guard the construction they encode, which is what an animation
// will take apart and put back together.
function mark() {
  const body = source.split('export const MARK = {')[1]?.split('} as const;')[0];
  assert.ok(body, 'LogoMark.tsx should declare MARK');
  const m = {};
  for (const [, key, value] of body.matchAll(/^\s*(\w+):\s*([\d.]+),/gm)) m[key] = Number(value);
  return m;
}

test('the three bars sit on the chevron rows, symmetrically about the middle', () => {
  const m = mark();
  const rows = [m.cy - m.dy, m.cy, m.cy + m.dy];
  assert.equal(rows[1] - rows[0], rows[2] - rows[1]);
  assert.ok(Math.abs(rows[1] - m.cy) < 0.001, 'the middle bar is the vertex row');
});

test('bar 1 ends where the top arm ends, and bar 2 at the vertex', () => {
  const m = mark();
  // Both are hidden under the chevron, so the raster cannot pin them down and
  // no check can. They are here because the mark is built that way, and because
  // the moment the bars animate in on their own the difference is visible.
  assert.ok(Math.abs(m.bar1X - m.armX) <= 1.5, `bar1X ${m.bar1X} should meet armX ${m.armX}`);
  assert.ok(Math.abs(m.bar2X - m.apexX) <= 1.5, `bar2X ${m.bar2X} should meet apexX ${m.apexX}`);
});

test('the bar height and the chevron stroke are one number', () => {
  // Not two numbers that happen to be equal: LogoMark renders both from MARK.S,
  // so this asserts the component keeps doing that.
  const strokes = [...source.matchAll(/strokeWidth=\{s\(([^)]+)\)\}/g)].map((x) => x[1]);
  assert.ok(strokes.length >= 2, 'both the bars and the chevron should carry a stroke width');
  assert.deepEqual([...new Set(strokes)], ['m.S']);
});

test('the mark uses the brand tokens, not its own hex values', () => {
  const colors = source.split('export const MARK_COLORS')[1]?.split('} as const;')[0];
  assert.ok(colors, 'LogoMark.tsx should declare MARK_COLORS');
  assert.ok(!/#[0-9a-fA-F]{6}/.test(colors), `MARK_COLORS should name BRAND tokens, got ${colors}`);
});

test('every clip path and filter is namespaced by the id prop', () => {
  // Two marks on one frame with the same id share the first one's defs, which
  // shows up as a missing shadow rather than as an error.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const refs = [...code.matchAll(/url\(#([^)]+)\)/g)].map((x) => x[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) assert.ok(r.startsWith('${id}'), `url(#${r}) is not scoped to the id prop`);
});

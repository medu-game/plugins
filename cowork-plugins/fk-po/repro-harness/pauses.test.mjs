import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSilences, planPauseCuts, shiftAlignment, shiftTime } from './pauses.mjs';

const OPTS = { maxPause: 0.5, tailSec: 0.45 };

test('parseSilences pairs starts with ends', () => {
  const stderr = [
    '[silencedetect @ 0x1] silence_start: 2.1',
    '[silencedetect @ 0x1] silence_end: 3.2 | silence_duration: 1.1',
    '[silencedetect @ 0x1] silence_start: 6.0',
    '[silencedetect @ 0x1] silence_end: 7.0 | silence_duration: 1.0',
  ].join('\n');
  assert.deepEqual(parseSilences(stderr), [
    { start: 2.1, end: 3.2 },
    { start: 6, end: 7 },
  ]);
});

test('a long pause between sentences keeps half a second, taken from its middle', () => {
  const cuts = planPauseCuts([{ start: 2, end: 3.2 }], 8, OPTS);
  assert.equal(cuts.length, 1);
  assert.ok(Math.abs(cuts[0].from - 2.25) < 1e-9);
  assert.ok(Math.abs(cuts[0].to - 2.95) < 1e-9);
});

test('a short pause is left alone', () => {
  assert.deepEqual(planPauseCuts([{ start: 2, end: 2.4 }], 8, OPTS), []);
});

test('the tail is cut back to the gap between beats', () => {
  assert.deepEqual(planPauseCuts([{ start: 6.5, end: 8 }], 8, OPTS), [{ from: 6.95, to: 8 }]);
});

test('silence at the very start is not a pause', () => {
  assert.deepEqual(planPauseCuts([{ start: 0, end: 0.9 }], 8, OPTS), []);
});

test('words after a cut move earlier by what was removed, and a lead-in moves everything later', () => {
  const cuts = [{ from: 2.25, to: 2.95 }];
  assert.equal(shiftTime(1, cuts), 1);
  assert.ok(Math.abs(shiftTime(4, cuts) - 3.3) < 1e-9);
  const moved = shiftAlignment({ characters: ['a', 'b'], startSec: [1, 4], endSec: [1.1, 4.1] }, cuts, 0.6);
  assert.deepEqual(moved.startSec, [1.6, 3.9]);
  assert.deepEqual(moved.endSec, [1.7, 4]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { locateLines } from './narrate.mjs';

// Shaped like what /with-timestamps returns for a two-line script: one entry
// per character of the input, including the separator, with monotonic times.
// The separator matters. Arithmetic on the joined string would work here and
// break the moment the API normalises whitespace, which is why locateLines
// matches instead of counting, so the fixture keeps the separator in.
function alignmentFor(text, secPerChar = 0.05) {
  const characters = [...text];
  return {
    characters,
    startSec: characters.map((_, i) => Number((i * secPerChar).toFixed(4))),
    endSec: characters.map((_, i) => Number(((i + 1) * secPerChar).toFixed(4))),
  };
}

const LINES = ['Hallo daar.', 'Tot ziens.'];

test('each line gets the times of its own first and last character', () => {
  const joined = LINES.join('\n\n');
  const spans = locateLines(alignmentFor(joined), LINES);

  assert.equal(spans.length, 2);
  assert.equal(spans[0].startSec, 0);
  // "Hallo daar." is 11 characters, so it ends at 11 * 0.05.
  assert.equal(spans[0].endSec, 0.55);
  // The second line starts after the two separator characters.
  assert.equal(spans[1].startSec, 0.65);
  assert.equal(spans[1].endSec, 1.15);
});

test('a separator the API dropped does not shift the second line', () => {
  const spans = locateLines(alignmentFor(LINES.join('')), LINES);

  assert.equal(spans[0].endSec, 0.55);
  assert.equal(spans[1].startSec, 0.55);
});

test('whitespace inside a line is skipped rather than matched', () => {
  // A single space collapsed to none, which is the normalisation this guards.
  const spans = locateLines(alignmentFor('Hallodaar.\n\nTot ziens.'), LINES);

  assert.ok(spans, 'the line should still be found');
  assert.equal(spans.length, 2);
});

test('text that does not match returns null so the caller can fall back', () => {
  assert.equal(locateLines(alignmentFor('Iets anders.'), LINES), null);
});

test('a truncated take returns null rather than a short last line', () => {
  // The failure that matters: the model stopped early, so the last line is
  // partly there. Returning a span for it would cut audio that does not exist.
  assert.equal(locateLines(alignmentFor('Hallo daar.\n\nTot zi'), LINES), null);
});

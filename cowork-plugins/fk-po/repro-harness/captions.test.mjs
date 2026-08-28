import { strict as assert } from 'node:assert';
import test from 'node:test';
import { buildVtt, formatTimestamp, splitBeat, toWords } from './captions.mjs';
import { INTRO_SEC } from './remotion/timing.mjs';

test('timestamps pad hours, minutes and milliseconds', () => {
  assert.equal(formatTimestamp(0), '00:00:00.000');
  assert.equal(formatTimestamp(2.5), '00:00:02.500');
  assert.equal(formatTimestamp(61.008), '00:01:01.008');
  assert.equal(formatTimestamp(3725.75), '01:02:05.750');
});

test('a negative time clamps instead of rendering a broken cue', () => {
  assert.equal(formatTimestamp(-1), '00:00:00.000');
});

test('cues are offset by the intro card, not by nothing', () => {
  const vtt = buildVtt([
    { narration: 'Eerste zin.', startSec: 0, durationSec: 4, alignment: null },
    { narration: 'Tweede zin.', startSec: 4, durationSec: 3.5, alignment: null },
  ]);

  assert.match(vtt, /^WEBVTT\n/);
  assert.ok(vtt.includes(`${formatTimestamp(INTRO_SEC)} --> ${formatTimestamp(INTRO_SEC + 4)}`));
  assert.ok(
    vtt.includes(`${formatTimestamp(INTRO_SEC + 4)} --> ${formatTimestamp(INTRO_SEC + 7.5)}`),
  );
});

test('cues are numbered from one and carry the narration verbatim', () => {
  const vtt = buildVtt([
    { narration: 'Klik op Taken.', startSec: 0, durationSec: 2, alignment: null },
  ]);
  const lines = vtt.split('\n');

  assert.equal(lines[0], 'WEBVTT');
  assert.equal(lines[2], '1');
  assert.equal(lines[4], 'Klik op Taken.');
});

test('an empty storyboard still produces a valid file', () => {
  assert.equal(buildVtt([]), 'WEBVTT\n');
});

test('without alignment a beat stays one cue', () => {
  const cues = splitBeat({ narration: 'Een zin.', durationSec: 4, alignment: null });

  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'Een zin.');
  assert.equal(cues[0].endSec, 4);
});

test('characters group into words carrying their own timings', () => {
  const words = toWords({
    characters: ['K', 'l', 'i', 'k', ' ', 'o', 'p'],
    startSec: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    endSec: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
  });

  assert.deepEqual(
    words.map((w) => w.text),
    ['Klik', 'op'],
  );
  assert.equal(words[0].startSec, 0);
  assert.equal(words[0].endSec, 0.4);
  assert.equal(words[1].startSec, 0.5);
});

test('a long sentence is cut at a word boundary, never mid-word', () => {
  const word = 'woord';
  const count = 30;
  const characters = [];
  const startSec = [];
  const endSec = [];
  let t = 0;
  for (let w = 0; w < count; w += 1) {
    for (const c of word) {
      characters.push(c);
      startSec.push(t);
      endSec.push(t + 0.05);
      t += 0.05;
    }
    characters.push(' ');
    startSec.push(t);
    endSec.push(t + 0.05);
    t += 0.05;
  }

  const cues = splitBeat({
    narration: Array(count).fill(word).join(' '),
    durationSec: t,
    alignment: { characters, startSec, endSec },
  });

  assert.ok(cues.length > 1, 'expected the sentence to be split');
  for (const cue of cues) {
    assert.ok(cue.text.length <= 80, `cue too long: ${cue.text.length}`);
    for (const piece of cue.text.split(' ')) {
      assert.equal(piece, word, 'a cue boundary landed inside a word');
    }
  }
  assert.equal(cues.at(-1).endSec, t);
});

test('cue times are absolute on the final timeline, beat offset included', () => {
  const vtt = buildVtt([
    { narration: 'Een.', startSec: 0, durationSec: 2, alignment: null },
    { narration: 'Twee.', startSec: 2, durationSec: 3, alignment: null },
  ]);

  assert.ok(vtt.includes(`${formatTimestamp(INTRO_SEC + 2)} --> ${formatTimestamp(INTRO_SEC + 5)}`));
});

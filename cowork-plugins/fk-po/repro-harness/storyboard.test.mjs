import { strict as assert } from 'node:assert';
import test from 'node:test';
import { buildHelpProps } from './storyboard.mjs';

// Shaped after a real events.jsonl from the taak-aanmaken recording: a login
// step first, then the beats. The login is what the rebasing has to remove,
// so a fixture that starts at the first beat would certify the bug instead of
// catching it.
const events = [
  { kind: 'start', t: 0, name: 'taak-aanmaken' },
  { kind: 'step', t: 0, label: 'Log in as the test account' },
  { kind: 'click', t: 900, x: 10, y: 20, label: 'Continue' },
  { kind: 'step', t: 2475, label: 'intro' },
  { kind: 'step', t: 11027, label: 'open-taken' },
  { kind: 'click', t: 11061, x: 36, y: 177, label: 'Taken' },
  { kind: 'step', t: 14557, label: 'klaar' },
  { kind: 'end', t: 20000 },
];

const narration = {
  mode: 'silent-stub',
  beats: [
    { id: 'intro', narration: 'Eerste zin.', audio: 'audio/intro.mp3', durationSec: 8.5 },
    { id: 'open-taken', narration: 'Tweede zin.', audio: 'audio/open-taken.mp3', durationSec: 3.5 },
    { id: 'klaar', narration: 'Derde zin.', audio: 'audio/klaar.mp3', durationSec: 5.4 },
  ],
};

const focus = { 'open-taken': { x: 0, y: 100, width: 200, height: 40 } };
const meta = { title: 'Een taak aanmaken', subtitle: 'Helpcentrum' };

test('the first beat starts at zero and the login is reported as trim', () => {
  const props = buildHelpProps(events, narration, focus, meta);

  assert.equal(props.captureStartSec, 2.475);
  assert.equal(props.beats[0].startSec, 0);
  assert.equal(props.beats[1].startSec, 11.027 - 2.475);
  assert.equal(props.captureDurationSec, 20 - 2.475);
});

test('setup clicks before the first beat are dropped, later ones rebased', () => {
  const props = buildHelpProps(events, narration, focus, meta);

  assert.equal(props.clicks.length, 1);
  assert.equal(props.clicks[0].atSec, 11.061 - 2.475);
  assert.equal(props.clicks[0].x, 36);
});

test('a beat keeps its narration, audio and focus box', () => {
  const props = buildHelpProps(events, narration, focus, meta);
  const beat = props.beats.find((b) => b.id === 'open-taken');

  assert.equal(beat.narration, 'Tweede zin.');
  assert.equal(beat.audio, 'audio/open-taken.mp3');
  assert.equal(beat.durationSec, 3.5);
  assert.deepEqual(beat.focus, { x: 0, y: 100, width: 200, height: 40 });
  assert.equal(props.beats.find((b) => b.id === 'intro').focus, null);
});

test('a step that is not a beat never becomes one', () => {
  const props = buildHelpProps(events, narration, focus, meta);

  assert.deepEqual(
    props.beats.map((b) => b.id),
    ['intro', 'open-taken', 'klaar'],
  );
});

test('a recording with no beat at all does not divide by a missing offset', () => {
  const props = buildHelpProps(
    [{ kind: 'start', t: 0 }, { kind: 'end', t: 5000 }],
    narration,
    {},
    meta,
  );

  assert.equal(props.captureStartSec, 0);
  assert.equal(props.captureDurationSec, 5);
  assert.deepEqual(props.beats, []);
});

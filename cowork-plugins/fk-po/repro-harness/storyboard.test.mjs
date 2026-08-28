import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  AUTHORED_BEAT_FIELDS,
  GENERATED_BEAT_FIELDS,
  buildHelpProps,
  validateStoryboard,
} from './storyboard.mjs';

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

// ---- validateStoryboard -----------------------------------------------------
// Every rule here exists because the pipeline swallowed the mistake once. The
// validator runs without a browser, so it is the cheapest gate in the chain.

const screen = (over = {}) => ({ id: 's1', narration: 'Een zin.', ...over });
const card = (over = {}) => ({ id: 'c1', kind: 'card', cardTitle: 'Kop', ...over });
const sbMeta = (over = {}) => ({ slug: 'x', title: 'Titel', subtitle: 'Een zin.', ...over });

const errorsFor = (beats, m = sbMeta()) => validateStoryboard(beats, m).errors.join(' | ');

test('a well-formed storyboard passes', () => {
  const result = validateStoryboard([card(), screen()], sbMeta());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('a beat without an id is rejected', () => {
  assert.match(errorsFor([screen({ id: undefined })]), /id/i);
});

test('duplicate ids are rejected because buildHelpProps keys on them', () => {
  assert.match(errorsFor([screen(), screen()]), /duplicate/i);
});

test('a screen beat without narration is rejected', () => {
  assert.match(errorsFor([screen({ narration: undefined })]), /narration/i);
});

test('a card with narration is rejected: cards are silent and uncaptioned', () => {
  assert.match(errorsFor([card({ narration: 'Niemand hoort dit.' })]), /card/i);
});

test('a card without a title is rejected', () => {
  assert.match(errorsFor([card({ cardTitle: undefined })]), /cardTitle/i);
});

test('preRollSec without an action is rejected: runStoryboard ignores it', () => {
  assert.match(errorsFor([screen({ preRollSec: 2 })]), /preRollSec/i);
});

test('preRollSec with an action is fine', () => {
  assert.equal(validateStoryboard([screen({ preRollSec: 2, action: () => {} })], sbMeta()).ok, true);
});

for (const field of ['narration', 'speech']) {
  test(`an em dash in ${field} is rejected (FE-COPY-1)`, () => {
    assert.match(errorsFor([screen({ [field]: 'Een zin — met een streepje.' })]), /em dash/i);
  });
}

for (const field of ['cardTitle', 'cardSubtitle', 'cardEyebrow']) {
  test(`an em dash in ${field} is rejected (FE-COPY-1)`, () => {
    assert.match(errorsFor([card({ [field]: 'Kop — met streepje' })]), /em dash/i);
  });
}

test('an em dash in meta.title or meta.subtitle is rejected: the intro shows both', () => {
  assert.match(errorsFor([screen()], sbMeta({ title: 'A — B' })), /em dash/i);
  assert.match(errorsFor([screen()], sbMeta({ subtitle: 'A — B' })), /em dash/i);
});

test('meta must carry slug, title and subtitle', () => {
  for (const key of ['slug', 'title', 'subtitle']) {
    assert.match(errorsFor([screen()], sbMeta({ [key]: undefined })), new RegExp(key, 'i'));
  }
});

test('a beat field the pipeline does not read is rejected', () => {
  // The recurring failure: cardDesign was copied by nobody, so setting it
  // changed nothing and looked like a decision. A field nothing reads is worse
  // than a missing one.
  assert.match(errorsFor([screen({ cardColour: 'green' })]), /cardColour/i);
});

test('the known-field list has not drifted from what the code reads', () => {
  // Derived from the source rather than typed, because a hand-kept list is the
  // same bug in a new place. Every field the pipeline reads off a beat must be
  // classified as authored or generated.
  const src = ['storyboard.mjs', 'narrate.mjs']
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'))
    .join('\n');
  const read = new Set(
    [...src.matchAll(/\b(?:beat|b)\.([a-zA-Z]+)/g)].map((m) => m[1]),
  );
  const classified = new Set([...AUTHORED_BEAT_FIELDS, ...GENERATED_BEAT_FIELDS]);
  const unclassified = [...read].filter((f) => !classified.has(f));
  assert.deepEqual(unclassified, [], `unclassified beat fields: ${unclassified.join(', ')}`);
});

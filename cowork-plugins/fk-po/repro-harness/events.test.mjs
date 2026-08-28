import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventLog, parseEvents, buildProps } from './events.mjs';

test('createEventLog writes JSONL with relative timestamps', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ev-')), 'events.jsonl');
  let clock = 1000;
  const log = createEventLog(file, () => clock);
  log.log('step', { label: 'Open klanten' });
  clock = 1500;
  log.log('click', { x: 10, y: 20, label: 'Klanten' });
  clock = 4000;
  log.finish();
  const events = parseEvents(readFileSync(file, 'utf8'));
  assert.deepEqual(events, [
    { kind: 'step', t: 0, label: 'Open klanten' },
    { kind: 'click', t: 500, x: 10, y: 20, label: 'Klanten' },
    { kind: 'end', t: 3000 },
  ]);
});

test('parseEvents reports the bad line number', () => {
  assert.throws(
    () => parseEvents('{"kind":"step","t":0}\nnot json\n'),
    /line 2/,
  );
});

test('buildProps maps events to ReproVideo props', () => {
  const events = [
    { kind: 'step', t: 0, label: 'Inloggen' },
    { kind: 'click', t: 500, x: 100, y: 200, label: 'Doorgaan' },
    { kind: 'step', t: 2000, label: 'Open klanten' },
    { kind: 'bug', t: 3500, label: 'Lijst is leeg' },
    { kind: 'end', t: 5000 },
  ];
  const props = buildProps(events, {
    title: 'Klantenlijst leeg na filter',
    env: 'acceptance',
    date: '2026-08-11',
  });
  assert.deepEqual(props, {
    title: 'Klantenlijst leeg na filter',
    env: 'acceptance',
    date: '2026-08-11',
    ticket: null,
    captureDurationSec: 5,
    steps: [
      { startSec: 0, label: 'Inloggen' },
      { startSec: 2, label: 'Open klanten' },
    ],
    clicks: [{ atSec: 0.5, x: 100, y: 200 }],
    bugMomentSec: 3.5,
  });
});

test('buildProps without bug/end events: bugMomentSec null, duration from last event', () => {
  const props = buildProps(
    [
      { kind: 'step', t: 0, label: 'Start' },
      { kind: 'click', t: 1200, x: 5, y: 6 },
    ],
    { title: 't', env: 'acceptance', date: '2026-08-11' },
  );
  assert.equal(props.bugMomentSec, null);
  assert.equal(props.captureDurationSec, 1.2);
});

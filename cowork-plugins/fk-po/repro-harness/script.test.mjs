import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSec, scriptHash, scriptLines } from './script.mjs';
import { parseVtt } from './frames.mjs';

const meta = { title: 'Je dashboard gebruiken', subtitle: 'Filteren en doorklikken.' };
const beats = [
  { id: 'kaart', kind: 'card', cardTitle: 'Van grafiek naar taak' },
  { id: 'filter', narration: 'Kies een collega.' },
  { id: 'updates', narration: 'Onder Updates reageer je.', speech: 'Onder updates reageer je.' },
];

test('the script shows what she reads and, where it differs, what she hears', () => {
  assert.deepEqual(scriptLines(beats, meta), [
    'Titel: Je dashboard gebruiken',
    'Ondertitel: Filteren en doorklikken.',
    '[kaart kaart] Van grafiek naar taak',
    '[filter] Kies een collega.',
    '[updates] Onder Updates reageer je.',
    '[updates uitgesproken] Onder updates reageer je.',
  ]);
});

test('an edit that lands changes the hash, so an earlier approval no longer opens a paid run', () => {
  const before = scriptHash(scriptLines(beats, meta));
  const edited = beats.map((b) => (b.id === 'filter' ? { ...b, narration: 'Kies een persoon.' } : b));
  assert.notEqual(scriptHash(scriptLines(edited, meta)), before);
  assert.equal(scriptHash(scriptLines(beats, meta)), before);
});

test('a single typographic apostrophe is enough to change the hash', () => {
  const plain = [{ id: 'a', narration: "collega's" }];
  const curly = [{ id: 'a', narration: 'collega’s' }];
  assert.notEqual(scriptHash(scriptLines(plain, meta)), scriptHash(scriptLines(curly, meta)));
});

test('length estimate counts spoken words, cards and the bumpers', () => {
  // 8s bumpers + 4.5s card + (3 + 4) words / 2.2
  assert.equal(estimateSec(beats), 16);
});

test('parseVtt reads cue times and joins multi-line text', () => {
  const cues = parseVtt('WEBVTT\n\n1\n00:00:01.500 --> 00:00:04.000\nKies een\ncollega.\n\n2\n00:01:02.000 --> 00:01:03.000\nKlaar.\n');
  assert.deepEqual(cues, [
    { start: 1.5, end: 4, text: 'Kies een collega.' },
    { start: 62, end: 63, text: 'Klaar.' },
  ]);
});

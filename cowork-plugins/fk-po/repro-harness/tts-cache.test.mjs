import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedSynthesize } from './tts-cache.mjs';
import { nextRunDir } from './fk-po-dir.mjs';

const opts = { voiceId: 'v', modelId: 'm', stability: 1 };

function fakeSynth() {
  const calls = [];
  const synth = async (text, outPath) => {
    calls.push(text);
    writeFileSync(outPath, `audio:${text}`);
    return { characters: [...text] };
  };
  return { calls, synth };
}

test('the same text with the same voice is synthesised once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-'));
  const cacheDir = join(dir, 'cache');
  const { calls, synth } = fakeSynth();

  const first = await cachedSynthesize('Hallo.', join(dir, 'a.mp3'), opts, { cacheDir, synth });
  const second = await cachedSynthesize('Hallo.', join(dir, 'b.mp3'), opts, { cacheDir, synth });

  assert.deepEqual(calls, ['Hallo.']);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.alignment, first.alignment);
  assert.equal(readFileSync(join(dir, 'b.mp3'), 'utf8'), 'audio:Hallo.');
});

test('changed text or a different voice is a new take', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-'));
  const cacheDir = join(dir, 'cache');
  const { calls, synth } = fakeSynth();

  await cachedSynthesize('Hallo.', join(dir, 'a.mp3'), opts, { cacheDir, synth });
  await cachedSynthesize('Hallo!', join(dir, 'a.mp3'), opts, { cacheDir, synth });
  await cachedSynthesize('Hallo.', join(dir, 'a.mp3'), { ...opts, voiceId: 'w' }, { cacheDir, synth });

  assert.equal(calls.length, 3);
});

test('a failed request leaves nothing in the cache', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-'));
  const cacheDir = join(dir, 'cache');
  const synth = async () => {
    throw new Error('ElevenLabs returned 500');
  };

  await assert.rejects(cachedSynthesize('Hallo.', join(dir, 'a.mp3'), opts, { cacheDir, synth }));
  assert.throws(() => readdirSync(cacheDir));
});

test('run dirs count up and never reuse a number', () => {
  const base = mkdtempSync(join(tmpdir(), 'runs-'));
  assert.match(nextRunDir(base, 'run'), /run-1$/);
  assert.match(nextRunDir(base, 'run'), /run-2$/);
  assert.match(nextRunDir(base, 'probe'), /probe-1$/);
});

test('fresh buys a new take of unchanged text and keeps that one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-'));
  const cacheDir = join(dir, 'cache');
  let take = 0;
  const synth = async (text, outPath) => {
    take += 1;
    writeFileSync(outPath, `take ${take}`);
    return null;
  };

  await cachedSynthesize('Hallo.', join(dir, 'a.mp3'), opts, { cacheDir, synth });
  const again = await cachedSynthesize('Hallo.', join(dir, 'b.mp3'), opts, { cacheDir, synth, fresh: true });
  await cachedSynthesize('Hallo.', join(dir, 'c.mp3'), opts, { cacheDir, synth });

  assert.equal(again.cached, false);
  assert.equal(take, 2);
  assert.equal(readFileSync(join(dir, 'c.mp3'), 'utf8'), 'take 2');
});

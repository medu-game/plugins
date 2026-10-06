import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGED_ASSETS, loadCapture, stagePublicDir } from './stage.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function fakeRun() {
  const root = mkdtempSync(join(tmpdir(), 'stage-test-'));
  const workDir = join(root, 'work');
  const assetsDir = join(root, 'assets');
  const publicDir = join(root, 'public');
  mkdirSync(join(workDir, 'audio'), { recursive: true });
  mkdirSync(assetsDir);
  writeFileSync(join(workDir, 'raw.mp4'), 'video');
  writeFileSync(join(workDir, 'audio', 'intro.mp3'), 'voice');
  for (const asset of STAGED_ASSETS) writeFileSync(join(assetsDir, asset), asset);
  return { workDir, assetsDir, publicDir };
}

test('a card beat has no audio and is skipped instead of crashing the stage', () => {
  const { workDir, assetsDir, publicDir } = fakeRun();
  const props = {
    beats: [
      { id: 'intro', kind: 'screen', audio: 'audio/intro.mp3' },
      { id: 'kaart', kind: 'card', audio: null },
    ],
  };

  stagePublicDir({ props, rawMp4: join(workDir, 'raw.mp4'), workDir, assetsDir, publicDir });

  assert.deepEqual(readdirSync(join(publicDir, 'audio')), ['intro.mp3']);
  assert.equal(readFileSync(join(publicDir, 'capture.mp4'), 'utf8'), 'video');
  for (const asset of STAGED_ASSETS) assert.ok(existsSync(join(publicDir, asset)), asset);
});

test('audio from an earlier run does not survive a new stage', () => {
  const { workDir, assetsDir, publicDir } = fakeRun();
  mkdirSync(join(publicDir, 'audio'), { recursive: true });
  writeFileSync(join(publicDir, 'audio', 'old-beat.mp3'), 'stale');

  stagePublicDir({
    props: { beats: [{ id: 'intro', audio: 'audio/intro.mp3' }] },
    rawMp4: join(workDir, 'raw.mp4'),
    workDir,
    assetsDir,
    publicDir,
  });

  assert.deepEqual(readdirSync(join(publicDir, 'audio')), ['intro.mp3']);
});

test('every committed file the compositions name is staged, and nothing else', () => {
  const sources = readdirSync(join(here, 'remotion'))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => readFileSync(join(here, 'remotion', f), 'utf8'))
    .join('\n');
  const named = new Set(
    [...sources.matchAll(/(?:staticFile\(|file:\s*)'([^']+\.(?:mp3|png))'/g)].map((m) => m[1]),
  );

  assert.deepEqual([...named].sort(), [...STAGED_ASSETS].sort());
  for (const asset of STAGED_ASSETS) assert.ok(existsSync(join(here, 'assets', asset)), asset);
});

test('a capture recorded on another machine is read from the work dir it sits in', () => {
  const { workDir } = fakeRun();
  writeFileSync(
    join(workDir, 'capture.json'),
    JSON.stringify({
      rawMp4: '/Users/someone/FlowKeeper/.fk-po/work/x/raw.mp4',
      eventsFile: '/Users/someone/FlowKeeper/.fk-po/work/x/events.jsonl',
      scenarioExitCode: 0,
    }),
  );

  const capture = loadCapture(workDir);

  assert.equal(capture.rawMp4, join(workDir, 'raw.mp4'));
  assert.equal(capture.eventsFile, join(workDir, 'events.jsonl'));
  assert.equal(capture.scenarioExitCode, 0);
  assert.equal(loadCapture(join(workDir, 'missing')), null);
});

test('a run carries the viewport it was recorded at, and older runs read as 1920', () => {
  const { workDir } = fakeRun();
  writeFileSync(join(workDir, 'capture.json'), JSON.stringify({ scenarioExitCode: 0 }));
  assert.deepEqual(loadCapture(workDir).viewport, { width: 1920, height: 1080 });

  writeFileSync(join(workDir, 'viewport.json'), JSON.stringify({ width: 1680, height: 944 }));
  assert.deepEqual(loadCapture(workDir).viewport, { width: 1680, height: 944 });
});

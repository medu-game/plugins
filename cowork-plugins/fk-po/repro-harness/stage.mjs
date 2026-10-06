// stage.mjs — put one help-video run where the compositions can read it.
//
// staticFile() only reads from the public dir, so a render and the studio both
// need the capture, the voice files and the committed assets copied there.
// render-help.mjs and stage-only.mjs each kept their own copy of this list and
// the two drifted: the studio lost the intro music and crashed on every card.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// stage.test.mjs fails when this stops matching what remotion/ names.
export const STAGED_ASSETS = [
  'intro-music.mp3',
  'outro-music.mp3',
  'sfx-ping.mp3',
  'logo-lockup-small.png',
  'logo-wordmark.png',
];

export function stagePublicDir({ props, rawMp4, workDir, assetsDir, publicDir }) {
  const publicAudio = join(publicDir, 'audio');
  rmSync(publicAudio, { recursive: true, force: true });
  mkdirSync(publicAudio, { recursive: true });
  copyFileSync(rawMp4, join(publicDir, 'capture.mp4'));
  for (const asset of STAGED_ASSETS) {
    copyFileSync(join(assetsDir, asset), join(publicDir, asset));
  }
  // A card is silent: no voice, so no file.
  for (const beat of props.beats.filter((b) => b.audio)) {
    copyFileSync(join(workDir, beat.audio), join(publicDir, beat.audio));
  }
}

/**
 * Read capture.json with its paths re-rooted at workDir. record-repro.mjs
 * writes absolute paths, so a run recorded on the Mac pointed at /Users/...
 * from inside the sandbox, and a moved work dir pointed nowhere.
 *
 * @returns {null | { rawMp4: string, eventsFile: string, scenarioExitCode: number, viewport: { width: number, height: number } }}
 */
export function loadCapture(workDir) {
  const path = join(workDir, 'capture.json');
  if (!existsSync(path)) return null;
  return {
    ...JSON.parse(readFileSync(path, 'utf8')),
    rawMp4: join(workDir, 'raw.mp4'),
    eventsFile: join(workDir, 'events.jsonl'),
    // Runs before viewport.json existed were all recorded at 1920x1080.
    viewport: existsSync(join(workDir, 'viewport.json'))
      ? JSON.parse(readFileSync(join(workDir, 'viewport.json'), 'utf8'))
      : { width: 1920, height: 1080 },
  };
}

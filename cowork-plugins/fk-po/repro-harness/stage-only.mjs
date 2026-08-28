// stage-only.mjs — put a finished run where the studio can see it.
//
// Usage: node stage-only.mjs --work <dir>
//
// Same staging render-help.mjs does, without the render. Use it to point the
// live preview at an earlier recording so visual tweaks cost nothing but a
// browser reload.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvents } from './events.mjs';
import { buildHelpProps, loadBeats, loadFocus } from './storyboard.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const workArg = argv[argv.indexOf('--work') + 1];
if (!workArg || argv.indexOf('--work') === -1) {
  console.error('Usage: stage-only.mjs --work <dir>');
  process.exit(1);
}

const workDir = resolve(workArg);
const captureJson = join(workDir, 'capture.json');
if (!existsSync(captureJson)) {
  console.error(`[stage] no capture.json in ${workDir}`);
  process.exit(1);
}

const capture = JSON.parse(readFileSync(captureJson, 'utf8'));
const narration = loadBeats(workDir);
const events = parseEvents(readFileSync(capture.eventsFile, 'utf8'));
const props = buildHelpProps(events, narration, loadFocus(workDir), {
  title: narration.meta?.title ?? 'Help video',
  subtitle: narration.meta?.subtitle ?? 'Flowkeeper helpcentrum',
});

const introSfxName = 'intro-sfx.mp3';
props.introSfx = existsSync(join(here, 'assets', introSfxName)) ? introSfxName : null;

const publicDir = join(here, 'remotion', 'public');
const publicAudio = join(publicDir, 'audio');
rmSync(publicAudio, { recursive: true, force: true });
mkdirSync(publicAudio, { recursive: true });
copyFileSync(capture.rawMp4, join(publicDir, 'capture.mp4'));
if (props.introSfx) copyFileSync(join(here, 'assets', props.introSfx), join(publicDir, props.introSfx));
// The brand intro clip and its settled lockup are committed assets too.
for (const asset of ['intro-dark.mp4', 'intro-light.mp4', 'logo-lockup.png',
  'sfx-whoosh.mp3', 'sfx-land.mp3', 'sfx-ping.mp3']) {
  const from = join(here, 'assets', asset);
  if (existsSync(from)) copyFileSync(from, join(publicDir, asset));
}
for (const beat of props.beats) copyFileSync(join(workDir, beat.audio), join(publicDir, beat.audio));

// The studio reads its props from the public dir, so the whole preview is one
// directory the container can mount.
writeFileSync(join(publicDir, 'studio-props.json'), JSON.stringify(props, null, 2), 'utf8');
// Root.tsx imports this one, so the studio opens on the real run instead of
// an empty placeholder.
writeFileSync(join(here, 'remotion', 'studio-props.json'), JSON.stringify(props, null, 2), 'utf8');

console.log(`[stage] ${props.beats.length} beats staged from ${workDir}`);
console.log('[stage] run ./studio.sh to preview, or render-help.mjs to render');

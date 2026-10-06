// stage-only.mjs — put a finished run where the studio can see it.
//
// Usage: node stage-only.mjs --work <dir>
//
// Same staging render-help.mjs does, without the render. Use it to point the
// live preview at an earlier recording so visual tweaks cost nothing but a
// browser reload.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvents } from './events.mjs';
import { buildHelpProps, loadBeats, loadFocus } from './storyboard.mjs';
import { loadCapture, stagePublicDir } from './stage.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const workArg = argv[argv.indexOf('--work') + 1];
if (!workArg || argv.indexOf('--work') === -1) {
  console.error('Usage: stage-only.mjs --work <dir>');
  process.exit(1);
}

const workDir = resolve(workArg);
const capture = loadCapture(workDir);
if (!capture) {
  console.error(`[stage] no capture.json in ${workDir}`);
  process.exit(1);
}

const narration = loadBeats(workDir);
const events = parseEvents(readFileSync(capture.eventsFile, 'utf8'));
const props = buildHelpProps(events, narration, loadFocus(workDir), {
  title: narration.meta?.title ?? 'Helpvideo',
  subtitle: narration.meta?.subtitle ?? '',
});
props.page = capture.viewport;

const publicDir = join(here, 'remotion', 'public');
stagePublicDir({
  props,
  rawMp4: capture.rawMp4,
  workDir,
  assetsDir: join(here, 'assets'),
  publicDir,
});

// The studio reads its props from the public dir, so the whole preview is one
// directory the container can mount, and studio.sh hands it this file with
// --props.
//
// It deliberately does NOT also write remotion/studio-props.json, the fallback
// Root.tsx imports. That one is COMMITTED, so writing it here left every
// checkout dirty from the first video onward and `git pull --ff-only` refused
// ever after. On a teammate's Mac that is the daily sync, failing in a log
// nobody reads.
writeFileSync(join(publicDir, 'studio-props.json'), JSON.stringify(props, null, 2), 'utf8');

console.log(`[stage] ${props.beats.length} beats staged from ${workDir}`);
console.log('[stage] run ./studio.sh to preview, or render-help.mjs to render');

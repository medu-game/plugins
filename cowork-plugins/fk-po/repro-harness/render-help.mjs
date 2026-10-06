// render-help.mjs — render stage of the help-video pipeline.
//
// Title and subtitle come from the storyboard's meta, which narrate.mjs already
// copied into beats.json. The flags are overrides for a one-off, not the place
// the strings live: passing them by hand meant the intro could say something
// the storyboard did not, and the storyboard is what the author edits.
//
// Usage: node render-help.mjs --work <dir> [--title "<Dutch title>"]
//                             [--subtitle "<line 2>"] [--out <dir>]
//
// Reads capture.json + events.jsonl (record-repro.mjs), beats.json (narrate.mjs)
// and focus.json (storyboard.mjs), stages the capture and the per-beat audio
// into remotion/public/, then renders the HelpVideo composition and writes the
// matching WebVTT next to the MP4.
//
// Deliberately separate from render.mjs rather than a flag on it: the two
// pipelines build different props from different inputs, and the bug flow must
// not start depending on narration files it never produces. The ~40 lines they
// share (out dir, remotion invocation, size report) are worth consolidating if
// this prototype survives.
//
// Exit codes:
//   0  success
//   1  bad arguments / missing inputs
//   4  remotion render failed

import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvents } from './events.mjs';
import { buildHelpProps, loadBeats, loadFocus } from './storyboard.mjs';
import { buildVtt } from './captions.mjs';
import { renderWithBrowserFallback } from './render-browser.mjs';
import { assertInstallMatchesPlatform } from './preflight.mjs';
import { loadCapture, stagePublicDir } from './stage.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { workDir: null, title: null, subtitle: null, outDir: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--work') out.workDir = argv[++i];
    else if (a === '--title') out.title = argv[++i];
    else if (a === '--subtitle') out.subtitle = argv[++i];
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '-h' || a === '--help') out.help = true;
    else {
      console.error(`[render-help] unknown argument: ${a}`);
      out.help = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.workDir) {
  console.error(
    'Usage: render-help.mjs --work <dir> [--title "<title>"] [--subtitle "<line>"] [--out <dir>]',
  );
  process.exit(args.help ? 0 : 1);
}

assertInstallMatchesPlatform('render-help');

const workDir = resolve(args.workDir);
const capture = loadCapture(workDir);
if (!capture) {
  console.error(`[render-help] no capture.json in ${workDir}; run record-repro.mjs first`);
  process.exit(1);
}
if (!existsSync(capture.rawMp4)) {
  console.error(`[render-help] capture video missing: ${capture.rawMp4}`);
  process.exit(1);
}

let narration;
try {
  narration = loadBeats(workDir);
} catch (error) {
  console.error(`[render-help] ${error.message}`);
  process.exit(1);
}

const title = args.title ?? narration.meta?.title ?? null;
const subtitle = args.subtitle ?? narration.meta?.subtitle ?? '';
if (!title) {
  console.error('[render-help] no title: the storyboard has no meta.title and none was passed');
  process.exit(1);
}

const events = parseEvents(readFileSync(capture.eventsFile, 'utf8'));
const props = buildHelpProps(events, narration, loadFocus(workDir), { title, subtitle });
props.page = capture.viewport;

if (props.beats.length === 0) {
  console.error('[render-help] no beat reached the recording; nothing to narrate');
  process.exit(1);
}
if (props.beats.length < narration.beats.length) {
  console.error(
    `[render-help] only ${props.beats.length} of ${narration.beats.length} beats were recorded; the scenario stopped early`,
  );
  process.exit(1);
}
if (props.beats.length > narration.beats.length) {
  console.error(
    `[render-help] ${props.beats.length} beat events for ${narration.beats.length} beats; ` +
      `${capture.eventsFile} holds more than one run. Record into a clean work dir.`,
  );
  process.exit(1);
}

const propsPath = join(workDir, 'help-props.json');
writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');

const publicDir = join(here, 'remotion', 'public');
stagePublicDir({
  props,
  rawMp4: capture.rawMp4,
  workDir,
  assetsDir: join(here, 'assets'),
  publicDir,
});

function defaultOutDir() {
  const candidates = [
    ...globSync('/sessions/*/mnt/FlowKeeper/.fk-po/videos'),
    ...(process.env.HOME ? [join(process.env.HOME, 'FlowKeeper/.fk-po/videos')] : []),
    '/workspace/.fk-po/videos',
  ];
  // Finished videos belong outside any repo: publish.sh mirrors this plugin
  // directory to a PUBLIC GitHub repo with cp -R, and its privacy gate greps with
  // -I so it cannot see inside an mp4. The in-repo out/ is the last resort.
  const found = candidates.find((c) => existsSync(c) || existsSync(dirname(c)));
  return found ?? join(here, 'out');
}
const outDir = resolve(args.outDir ?? defaultOutDir());
mkdirSync(outDir, { recursive: true });

const slug =
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'help';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').slice(0, 19);
const mp4Path = join(outDir, `help-${slug}-${stamp}.mp4`);
const vttPath = mp4Path.replace(/\.mp4$/, '.vtt');

console.log(`[render-help] props   : ${propsPath}`);
console.log(`[render-help] beats   : ${props.beats.length} (${narration.mode})`);

const render = await renderWithBrowserFallback({
  args: [
    'remotion',
    'render',
    'remotion/index.ts',
    'HelpVideo',
    mp4Path,
    `--props=${propsPath}`,
    `--public-dir=${publicDir}`,
    '--concurrency=2',
  ],
  spawnOptions: { cwd: here, stdio: ['ignore', 'inherit', 'pipe'] },
  log: (msg) => console.log(`[render-help] ${msg}`),
  spawnSync,
});
if (render.status !== 0) {
  console.error('[render-help] remotion render failed:');
  console.error((render.stderr?.toString() ?? '').split('\n').slice(-20).join('\n'));
  process.exit(4);
}

const vtt = buildVtt(props.beats);
writeFileSync(vttPath, vtt, 'utf8');
// ElevenLabs history does not say which voice read a take, so "which voice did
// the last video use?" is only answerable from this file.
writeFileSync(
  mp4Path.replace(/\.mp4$/, '.json'),
  JSON.stringify({ voice: narration.voice ?? null, workDir }, null, 2),
  'utf8',
);
const cueCount = (vtt.match(/ --> /g) ?? []).length;

function sizeKb(p) {
  try {
    return Math.round(statSync(p).size / 1024);
  } catch {
    return 0;
  }
}

console.log('---');
console.log(`[render-help] MP4 ${mp4Path} (${sizeKb(mp4Path)} KB)`);
console.log(`[render-help] VTT ${vttPath} (${cueCount} cues from ${props.beats.length} beats)`);

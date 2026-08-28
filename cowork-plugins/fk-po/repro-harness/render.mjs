// render.mjs — render stage of the PO bug-repro pipeline.
//
// Usage: node render.mjs --work <dir> --title "<Dutch title>"
//                        [--ticket FK-###] [--out <dir>]
//
// Reads capture.json + events.jsonl (from record-repro.mjs), builds the
// ReproVideo props, stages raw.mp4 into remotion/public/capture.mp4, and
// renders the annotated Full HD MP4 with the Remotion CLI (using Playwright's
// Chromium so Remotion never downloads its own headless shell).
//
// Exit codes:
//   0  success
//   1  bad arguments / missing capture
//   4  remotion render failed (caller falls back to attaching raw.mp4)

import {
  copyFileSync,
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
import { buildProps, parseEvents } from './events.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { workDir: null, title: null, ticket: null, outDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--work') out.workDir = argv[++i];
    else if (a === '--title') out.title = argv[++i];
    else if (a === '--ticket') out.ticket = argv[++i];
    else if (a === '--out') out.outDir = argv[++i];
    else if (a === '-h' || a === '--help') out.help = true;
    else {
      console.error(`[render] unknown argument: ${a}`);
      out.help = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.workDir || !args.title) {
  console.error(
    'Usage: render.mjs --work <dir> --title "<title>" [--ticket FK-###] [--out <dir>]',
  );
  process.exit(args.help ? 0 : 1);
}
if (args.ticket && !/^FK-\d+$/.test(args.ticket)) {
  console.error(`[render] --ticket must look like FK-123 (got "${args.ticket}")`);
  process.exit(1);
}

const workDir = resolve(args.workDir);
const captureJson = join(workDir, 'capture.json');
if (!existsSync(captureJson)) {
  console.error(`[render] no capture.json in ${workDir}; run record-repro.mjs first`);
  process.exit(1);
}
const capture = JSON.parse(readFileSync(captureJson, 'utf8'));
if (!existsSync(capture.rawMp4)) {
  console.error(`[render] capture video missing: ${capture.rawMp4}`);
  process.exit(1);
}

// Default output dir: Melissa's persistent videos folder, wherever it is
// mounted, falling back to ./out for dev runs.
function defaultOutDir() {
  const candidates = [
    ...globSync('/sessions/*/mnt/FlowKeeper/.fk-po/videos'),
    ...(process.env.HOME
      ? [join(process.env.HOME, 'FlowKeeper/.fk-po/videos')]
      : []),
    '/workspace/.fk-po/videos',
  ];
  // Finished videos belong outside any repo: publish.sh mirrors this plugin
  // directory to a PUBLIC GitHub repo with cp -R, and its privacy gate greps with
  // -I so it cannot see inside an mp4. The in-repo out/ is the last resort.
  const found = candidates.find(
    (c) => existsSync(c) || existsSync(dirname(c)),
  );
  return found ?? join(here, 'out');
}
const outDir = resolve(args.outDir ?? defaultOutDir());
mkdirSync(outDir, { recursive: true });

// Build props from the recorded events.
const events = parseEvents(readFileSync(capture.eventsFile, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const props = buildProps(events, {
  title: args.title,
  env: 'acceptance',
  date: today,
  ticket: args.ticket,
});
const propsPath = join(workDir, 'props.json');
writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');

// Stage the capture where the composition's staticFile() expects it.
const publicDir = join(here, 'remotion', 'public');
mkdirSync(publicDir, { recursive: true });
copyFileSync(capture.rawMp4, join(publicDir, 'capture.mp4'));

const slug =
  args.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'repro';
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace(/T/, '_')
  .slice(0, 19);
const mp4Path = join(outDir, `bug-${slug}-${stamp}.mp4`);

// Remotion renders through a browser; reuse Playwright's Chromium.
const { chromium } = await import('playwright');
const browserExecutable = chromium.executablePath();

console.log(`[render] props   : ${propsPath}`);
console.log(`[render] browser : ${browserExecutable}`);

const render = spawnSync(
  'npx',
  [
    'remotion',
    'render',
    'remotion/index.ts',
    'ReproVideo',
    mp4Path,
    `--props=${propsPath}`,
    `--browser-executable=${browserExecutable}`,
    // The public dir lives inside remotion/, not at the package root.
    `--public-dir=${publicDir}`,
    '--concurrency=2',
  ],
  { cwd: here, stdio: ['ignore', 'inherit', 'pipe'] },
);
if (render.status !== 0) {
  const stderr = render.stderr?.toString() ?? '';
  console.error('[render] remotion render failed:');
  console.error(stderr.split('\n').slice(-20).join('\n'));
  console.error(`[render] fallback: attach the raw capture instead (${capture.rawMp4})`);
  process.exit(4);
}

function sizeKb(p) {
  try {
    return Math.round(statSync(p).size / 1024);
  } catch {
    return 0;
  }
}

console.log('---');
console.log(`[render] MP4 ${mp4Path} (${sizeKb(mp4Path)} KB)`);

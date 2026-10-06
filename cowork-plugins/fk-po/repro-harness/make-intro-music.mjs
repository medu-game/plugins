// make-intro-music.mjs — generate the cue that plays over the logo build.
//
// This exists as a script rather than a one-off call because the voice previews
// were made ad hoc in an earlier session and their provenance was lost with the
// session: nobody could tell afterwards which voice a file came from. The
// prompt and the shaping live here so the next person can see exactly what
// produced the committed asset.
//
// The generated source is KEPT next to the output. Cutting a different window
// out of the same track is then free, and that matters: two review rounds were
// spent regenerating because the source had been deleted, and every generation
// is a different piece of music. Use --recut to re-cut without generating.
//
//   node make-intro-music.mjs [--out assets/intro-music.mp3]
//                             [--length-ms N] [--source-ms N] [--recut]
//   node make-intro-music.mjs --outro
//
// --outro writes assets/outro-music.mp3 from the kept source and touches
// nothing else: the same piece's arrival chord, landing on the first frame of
// the outro and fading out with the logo, so the video closes on the music it
// opened with.

import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApiKey } from './narrate.mjs';
import { INTRO_MUSIC_SEC, OUTRO_SEC } from './remotion/timing.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://api.elevenlabs.io/v1/music';

// When the logo animation lands its mark, measured on intro-light.mp4. Two
// things aim at this beat: the window is cut so the source material peaks here
// if it has a peak at all, and the fade-in reaches full volume here. They agree
// rather than fight, because the fade is at full exactly when the peak lands.
const MARK_LANDS_AT_SEC = 2.3;
// The rise into the arrival is CONSTRUCTED, not found. Asked five times for a
// cue that builds and lands, the generator returned four hits-with-a-tail and
// one flat bed at -16 dB across the whole first half. So the fade-in runs to
// exactly the beat where the logo lands its mark: quiet at the first frame,
// full when the mark arrives, and holding after. Deterministic, where waiting
// for the model to write dynamics is a lottery.
const FADE_IN_SEC = MARK_LANDS_AT_SEC;
// The fade starts this far before the end, so at 2.5 it begins just after the
// title has finished arriving and is long gone by the first spoken line. Tim
// asked for earlier on 2026-08-25: a fade that only starts a second before the
// voice reads as the music being cut off by it.
const FADE_OUT_SEC = 2.5;

// Step for the level scan. Finer costs one ffmpeg call per step for no useful
// extra precision at this length.
const STEP_SEC = 0.5;

// A cue, not a soundtrack. Tim's call on 2026-08-25: the music plays only over
// the logo build and stops there, rather than sitting under the title as well.
//
// Asking for three seconds does not work. Four runs on 2026-08-25, one prompt
// asking in as many words for a rise arriving two seconds in, produced four
// tracks that all peaked on the first frame and decayed: at that length the
// model gives a hit with a tail and nothing else. Longer requests do have
// internal shape, so the fix is not a better prompt. Generate long, find the
// peak, and cut the window that leads into it.
// Melissa, 2026-09-13: the earlier "understated, nothing triumphant" cue sounded
// mysterious in the finished video rather than helpful. FK_MUSIC_PROMPT tries an
// alternative without editing this file; what ends up in assets belongs here.
const PROMPT = process.env.FK_MUSIC_PROMPT || [
  'Bright friendly cue for a software logo animation.',
  'Warm major key marimba and soft piano with a light airy pad underneath,',
  'cheerful and welcoming, gently rising to a satisfying resolve about a third of',
  'the way in, then settling into a soft sustained chord that keeps holding much',
  'quieter for the rest of the piece.',
  'Upbeat and approachable, nothing mysterious, nothing dark, nothing cinematic.',
  'Instrumental only, no vocals, no drums, no riser, no impact hit.',
].join(' ');

function parseArgs(argv) {
  const out = {
    outPath: join(here, 'assets', 'intro-music.mp3'),
    lengthMs: null,
    sourceMs: null,
    recut: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') out.outPath = resolve(argv[++i]);
    else if (argv[i] === '--length-ms') out.lengthMs = Number(argv[++i]);
    else if (argv[i] === '--source-ms') out.sourceMs = Number(argv[++i]);
    else if (argv[i] === '--recut') out.recut = true;
    else if (argv[i] === '--outro') out.outro = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const targetSec = (args.lengthMs ?? Math.round(INTRO_MUSIC_SEC * 1000)) / 1000;
// The window has to fit after the peak, so the source needs headroom beyond the
// target: enough for the whole intro plus a peak that lands late.
const sourceMs = args.sourceMs ?? Math.round((targetSec + 6) * 1000);

const ffmpeg = (await import('@ffmpeg-installer/ffmpeg')).default.path;

function durationOf(path) {
  const probe = spawnSync(ffmpeg, ['-i', path], { encoding: 'utf8' });
  const m = probe.stderr.match(/Duration: (\d+):(\d+):([0-9.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function meanDbAt(path, atSec, forSec) {
  const probe = spawnSync(
    ffmpeg,
    ['-hide_banner', '-ss', String(atSec), '-t', String(forSec), '-i', path,
      '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const m = probe.stderr.match(/mean_volume: (-?[0-9.]+) dB/);
  return m ? Number(m[1]) : null;
}

console.log(`[music] target : ${targetSec}s (INTRO_MUSIC_SEC ${INTRO_MUSIC_SEC}s)`);

const raw = args.outPath.replace(/\.mp3$/, '.source.mp3');

if (args.recut || args.outro) {
  if (!existsSync(raw)) {
    console.error(`[music] --recut needs ${raw}, which does not exist`);
    process.exit(1);
  }
  console.log(`[music] recut  : ${raw}, no generation`);
} else {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error('[music] no ELEVENLABS_API_KEY; see melissa-setup.md, eleven.env');
    process.exit(1);
  }
  console.log(`[music] source : ${sourceMs} ms requested`);
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, music_length_ms: sourceMs }),
  });
  if (!response.ok) {
    console.error(`[music] ${response.status}: ${(await response.text()).slice(0, 400)}`);
    process.exit(1);
  }
  writeFileSync(raw, Buffer.from(await response.arrayBuffer()));
}
const rawSec = durationOf(raw);
if (rawSec === null) {
  console.error('[music] could not read the generated file');
  process.exit(1);
}
// music_length_ms is a request, not a contract: 7000 came back as 7.05s once
// and 9.04s the next time.
console.log(`[music] source : ${rawSec.toFixed(2)}s generated`);

const scan = [];
for (let t = 0; t + STEP_SEC <= rawSec; t += STEP_SEC) {
  scan.push({ at: t, db: meanDbAt(raw, t, STEP_SEC) });
}
const heard = scan.filter((s) => s.db !== null);
if (heard.length === 0) {
  console.error('[music] could not measure the generated file');
  process.exit(1);
}
const peak = heard.reduce((a, b) => (b.db > a.db ? b : a));
console.log(`[music] peak   : ${peak.at}s at ${peak.db} dB`);

if (args.outro) {
  const outroPath = join(here, 'assets', 'outro-music.mp3');
  // A short fade-in only to avoid a click; the chord itself is the entrance.
  const outroStart = Math.min(Math.max(peak.at - 0.2, 0), Math.max(rawSec - OUTRO_SEC, 0));
  const outroFades = [
    'afade=t=in:st=0:d=0.08',
    `afade=t=out:st=${(OUTRO_SEC * 0.35).toFixed(2)}:d=${(OUTRO_SEC * 0.65).toFixed(2)}`,
  ].join(',');
  const outroCut = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', String(outroStart), '-t',
    String(OUTRO_SEC), '-i', raw, '-af', outroFades,
    '-c:a', 'libmp3lame', '-q:a', '2', outroPath]);
  if (outroCut.status !== 0) {
    console.error(`[music] outro cut failed: ${outroCut.stderr?.toString().slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`[music] outro  : ${outroStart.toFixed(2)}s to ${(outroStart + OUTRO_SEC).toFixed(2)}s -> ${outroPath}`);
  process.exit(0);
}
if (peak.db < -35) {
  console.log('[music] WARNING: nothing here is loud enough to hear under the animation.');
  console.log('[music] Run this again.');
}

// Place the peak on the beat where the mark lands, so the cue rises into its
// arrival instead of opening on it.
const start = Math.min(Math.max(peak.at - MARK_LANDS_AT_SEC, 0), Math.max(rawSec - targetSec, 0));
console.log(`[music] window : ${start.toFixed(2)}s to ${(start + targetSec).toFixed(2)}s`);

const fades = [
  `afade=t=in:st=0:d=${FADE_IN_SEC}`,
  `afade=t=out:st=${(targetSec - FADE_OUT_SEC).toFixed(2)}:d=${FADE_OUT_SEC}`,
].join(',');
const cut = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', String(start), '-t',
  String(targetSec), '-i', raw, '-af', fades,
  '-c:a', 'libmp3lame', '-q:a', '2', args.outPath]);
if (cut.status !== 0) {
  console.error(`[music] cut failed: ${cut.stderr?.toString().slice(0, 300)}`);
  process.exit(1);
}
console.log(`[music] kept   : ${raw} (re-cut with --recut, no new generation)`);

const levels = [];
for (let t = 0; t + STEP_SEC <= targetSec + 0.001; t += STEP_SEC) {
  levels.push(`${t}s ${meanDbAt(args.outPath, t, STEP_SEC) ?? '?'}`);
}
console.log(`[music] wrote ${args.outPath} (${durationOf(args.outPath)?.toFixed(2)}s)`);
console.log(`[music] shape  : ${levels.join('  ')}`);

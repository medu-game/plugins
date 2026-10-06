// frames.mjs — one still per subtitle cue of a finished help video, for the
// review before it is handed over.
//
// Usage: node frames.mjs <video.mp4>
//
// Reads the .vtt next to the MP4 and grabs the frame at the middle of every cue,
// plus the last frame, into <video>-frames/. Prints each path with the caption
// on screen at that moment, so every sentence is checked against its picture.
// Hand-picking four or five frames is how a timeline hidden under the subtitles
// shipped on 2026-10-02 while the review said nothing was cut off.
//
// Uses the bundled ffmpeg when none is on PATH: a Mac has none by default.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function toSec(stamp) {
  const parts = stamp.split(':').map(Number);
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}

export function parseVtt(text) {
  const cues = [];
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const at = lines.findIndex((l) => l.includes(' --> '));
    if (at < 0) continue;
    const [start, end] = lines[at].split(' --> ').map((s) => toSec(s.trim().split(/\s+/)[0]));
    cues.push({ start, end, text: lines.slice(at + 1).join(' ').trim() });
  }
  return cues;
}

function ffmpegBin(binary) {
  if (spawnSync(binary, ['-version'], { stdio: 'ignore' }).status === 0) return binary;
  const pkg = binary === 'ffprobe' ? '@ffprobe-installer/ffprobe' : '@ffmpeg-installer/ffmpeg';
  try {
    return require(pkg).path;
  } catch {
    return null;
  }
}

function durationSec(ffmpeg, mp4) {
  const out = spawnSync(ffmpeg, ['-i', mp4], { encoding: 'utf8' }).stderr ?? '';
  const m = out.match(/Duration: (\d+:\d+:\d+(?:\.\d+)?)/);
  return m ? toSec(m[1]) : null;
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  const mp4 = process.argv[2] ? resolve(process.argv[2]) : null;
  if (!mp4 || !existsSync(mp4)) {
    console.error('Usage: frames.mjs <video.mp4>');
    process.exit(1);
  }
  const vtt = mp4.replace(/\.mp4$/, '.vtt');
  if (!existsSync(vtt)) {
    console.error(`[frames] no subtitle file next to the video: ${vtt}`);
    process.exit(1);
  }
  const ffmpeg = ffmpegBin('ffmpeg');
  if (!ffmpeg) {
    console.error('[frames] ffmpeg not found; run npm run setup in the harness');
    process.exit(1);
  }

  const outDir = mp4.replace(/\.mp4$/, '-frames');
  mkdirSync(outDir, { recursive: true });
  const shots = parseVtt(readFileSync(vtt, 'utf8')).map((cue) => ({
    sec: (cue.start + cue.end) / 2,
    text: cue.text,
  }));
  const total = durationSec(ffmpeg, mp4);
  if (total) shots.push({ sec: Math.max(0, total - 0.2), text: '(laatste frame)' });

  for (const [i, shot] of shots.entries()) {
    const png = join(outDir, `${String(i + 1).padStart(2, '0')}-${shot.sec.toFixed(1)}s.png`);
    const r = spawnSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-ss', shot.sec.toFixed(2), '-i', mp4, '-frames:v', '1', png,
    ]);
    if (r.status !== 0) {
      console.error(`[frames] could not grab ${shot.sec.toFixed(1)}s`);
      process.exit(1);
    }
    console.log(`${png}\n    ${shot.text}`);
  }
  console.log(`[frames] ${shots.length} frames of ${basename(mp4)} in ${outDir}`);
}

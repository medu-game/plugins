// pauses.mjs — keeps the voice flowing: shortens the long silences a take puts
// between sentences, and lets a picture settle before the voice starts.
//
// Melissa, on the 2026-10-05 dashboard video: "dan is het een seconde stil, of
// langer. Dat is raar en voelt niet vloeiend." Fenna on eleven_v3 pauses 0.8 to
// 1.5s between sentences; a person reading a help text pauses about half that.
// The silences are found in the audio itself rather than in the alignment, which
// spreads a pause over the punctuation and spaces in ways that differ per take.

import { spawnSync } from 'node:child_process';
import { renameSync } from 'node:fs';

export function parseSilences(stderr) {
  const silences = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start !== null) {
      silences.push({ start, end: Number(e[1]) });
      start = null;
    }
  }
  return silences;
}

/**
 * The stretches to remove so no pause inside a line lasts longer than maxPause,
 * and the line ends on exactly tailSec of silence. Each cut takes the middle of
 * a pause, so the breath on both sides of it survives.
 */
export function planPauseCuts(silences, totalSec, { maxPause, tailSec, edge = 0.05 }) {
  const cuts = [];
  for (const { start, end } of silences) {
    if (start <= edge) continue;
    if (end >= totalSec - edge) {
      if (end - start > tailSec + edge) cuts.push({ from: start + tailSec, to: totalSec });
      continue;
    }
    if (end - start > maxPause) {
      cuts.push({ from: start + maxPause / 2, to: end - maxPause / 2 });
    }
  }
  return cuts;
}

/** Move a time onto the shortened timeline. */
export function shiftTime(t, cuts) {
  let removed = 0;
  for (const { from, to } of cuts) {
    if (t >= to) removed += to - from;
    else if (t > from) removed += t - from;
  }
  return t - removed;
}

export function shiftAlignment(alignment, cuts, offsetSec = 0) {
  if (!alignment) return alignment;
  const move = (t) => Number((shiftTime(t, cuts) + offsetSec).toFixed(4));
  return {
    ...alignment,
    startSec: alignment.startSec.map(move),
    endSec: alignment.endSec.map(move),
  };
}

function ffmpeg(ffmpegBin, args, what) {
  const result = spawnSync(ffmpegBin, ['-y', '-loglevel', 'error', ...args]);
  if (result.status !== 0) {
    throw new Error(`ffmpeg could not ${what}: ${result.stderr?.toString().slice(0, 200)}`);
  }
}

function detectSilences(path, ffmpegBin, minSec) {
  const result = spawnSync(ffmpegBin, [
    '-hide_banner', '-i', path, '-af', `silencedetect=noise=-40dB:d=${minSec}`, '-f', 'null', '-',
  ]);
  const stderr = result.stderr?.toString() ?? '';
  const total = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const totalSec = total ? Number(total[1]) * 3600 + Number(total[2]) * 60 + Number(total[3]) : 0;
  return { silences: parseSilences(stderr), totalSec };
}

/**
 * Shorten the pauses inside one beat's audio and, when leadInSec is set, put
 * that much silence in front of it. Returns the alignment on the new timeline
 * and the seconds removed.
 */
export function tightenBeatAudio(path, alignment, ffmpegBin, { maxPause, tailSec, leadInSec = 0 }) {
  const { silences, totalSec } = detectSilences(path, ffmpegBin, Math.min(maxPause, tailSec));
  const cuts = planPauseCuts(silences, totalSec, { maxPause, tailSec });
  const filters = [];
  if (cuts.length > 0) {
    const drop = cuts.map(({ from, to }) => `between(t,${from.toFixed(3)},${to.toFixed(3)})`).join('+');
    filters.push(`aselect='not(${drop})'`, 'asetpts=N/SR/TB');
  }
  if (leadInSec > 0) filters.push(`adelay=${Math.round(leadInSec * 1000)}:all=1`);
  if (filters.length > 0) {
    const tmp = `${path}.tight.mp3`;
    ffmpeg(ffmpegBin, ['-i', path, '-af', filters.join(','), '-c:a', 'libmp3lame', '-q:a', '2', tmp], `tighten ${path}`);
    renameSync(tmp, path);
  }
  return {
    alignment: shiftAlignment(alignment, cuts, leadInSec),
    removedSec: cuts.reduce((sum, c) => sum + (c.to - c.from), 0),
  };
}

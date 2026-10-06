// narrate.mjs — voice-over stage of the help-video pipeline.
//
// Usage: node narrate.mjs <storyboard.mjs> --work <dir> [--voice <id>]
//                          [--stability 0|0.5|1]
//
// Reads a storyboard, produces one audio file per beat plus beats.json with
// the measured duration of each. This runs BEFORE capture: the spoken length
// of a beat is what tells the scenario how long to dwell on that screen.
// That ordering is the whole difference from the bug-repro pipeline, which
// records first and places captions at observed step times.
//
// Two modes behind one interface:
//   ELEVENLABS_API_KEY set -> real Dutch text to speech
//   otherwise              -> a silent track of an estimated length, so the
//                             rest of the chain can be proven without a key
//
// Durations are always measured off the produced file with ffprobe, never
// taken from the estimate, so both modes feed render the same kind of truth.
//
// Exit codes:
//   0  success
//   1  bad arguments / unreadable storyboard
//   5  text to speech failed

import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DESIGN_MIN_SEC } from './remotion/card-designs.mjs';
import { resolveFkPoDir } from './fk-po-dir.mjs';
import { cachedSynthesize } from './tts-cache.mjs';
import { tightenBeatAudio } from './pauses.mjs';

const require = createRequire(import.meta.url);

const ELEVENLABS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';
// --voice takes either name or a raw id. Fenna is the house voice, Melissa's
// pick on 2026-09-13. man and vrouw are Tim's designed voices, judged best on v4.
export const VOICES = {
  fenna: 'p4efl2GlWK0o6sAQEEkp',
  man: 'U4S7eJBqHUvUlS4hiNhx',
  vrouw: 'a0pCzzi71BFyUJUDzeTq',
};
export const DEFAULT_VOICE_NAME = 'fenna';
const DEFAULT_VOICE = VOICES[DEFAULT_VOICE_NAME];
// v4 replaced v3 on 2026-10-05. eleven_v4_hq is not open to this account.
const DEFAULT_MODEL = 'eleven_v4';
// 1.0 is the steadiest read, the one Tim chose on v3; lower values let the
// model act more. Fenna reads at 0.5: Melissa found the steady male read too
// flat, and picked Fenna as the only voice lively enough (2026-09-13).
const DEFAULT_STABILITY = 1.0;
const VOICE_STABILITY = { fenna: 0.5 };
// Fenna stays on v3: on v4 she reads with a slight English accent (Tim,
// 2026-10-06, same sentence on both models).
const VOICE_MODEL = { fenna: 'eleven_v3' };
// Silence appended to every beat's audio. Sentences synthesized back to back
// arrive too fast on top of each other; this is the breath between them, and it
// is added here rather than asked of the model so it is the same every run.
const GAP_SEC = 0.45;
// One request for the whole script, then cut. Synthesizing line by line gave
// each line its own read: same voice id, audibly different delivery, because
// the model has no context beyond the sentence it is given. Set --per-beat to
// go back to the old path.
const JOIN = '\n\n';
// Timing, all from Melissa's review of the 2026-10-05 dashboard video:
// - no pause inside a line longer than this; v3 put 0.8 to 1.5s between sentences
const MAX_PAUSE_SEC = 0.5;
// - the picture settles this long before the voice starts, after the intro and
//   after every card; the voice used to land on the first frame
const LEAD_IN_SEC = 0.6;
// - a screen beat outlasts its voice by at most this. Longer only when its
//   action still runs, which the recording waits for by itself. minSec 16 on a
//   line of 11s left five silent seconds at 0:32.
const MAX_HOLD_SEC = 1.0;

// Calm Dutch narration runs around 2.6 words a second. The trailing pause
// gives the viewer a beat to look at what was just described.
const WORDS_PER_SEC = 2.6;
const TAIL_PAUSE_SEC = 0.8;
const MIN_BEAT_SEC = 2.0;
// A full-screen statement needs time to be read, not just heard. It was also
// padding for the old 0.9s card fade-out, which is gone. Measured against the
// ported designs on 2026-08-25: the task rows finish at 3.35s and the flow line
// at 3.5s, so 3.6 is now the length of the animation rather than a guess. Shrink
// this and a card cuts away mid-draw.
const CARD_MIN_SEC = 3.6;

/**
 * The key never belongs in a command line or a repo. Same lookup shape as
 * helpers.mjs uses for the app credentials.
 */
export function resolveApiKey(env = process.env) {
  if (env.ELEVENLABS_API_KEY) return env.ELEVENLABS_API_KEY;
  const candidates = [
    ...globSync('/sessions/*/mnt/FlowKeeper/.fk-po/eleven.env'),
    env.HOME ? join(env.HOME, 'FlowKeeper/.fk-po/eleven.env') : null,
    '/workspace/.fk-po/eleven.env',
  ].filter(Boolean);
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

/**
 * Locate each line inside a whole-script alignment.
 *
 * Deliberately a matcher rather than arithmetic on the joined string: the API
 * may normalise whitespace or drop the separator, and offsets computed from the
 * input would then be silently wrong by a few characters, which is a caption
 * that starts mid word. This walks the returned characters and consumes each
 * line, ignoring whitespace on either side, so it survives that.
 *
 * Returns one { startSec, endSec, from, to } per line, or null if any line
 * could not be found, in which case the caller falls back to per-line calls.
 */
export function locateLines(alignment, lines) {
  const chars = alignment.characters;
  const spans = [];
  let i = 0;
  for (const line of lines) {
    const wanted = [...line].filter((c) => !/\s/.test(c));
    let matched = 0;
    let from = -1;
    let to = -1;
    while (i < chars.length && matched < wanted.length) {
      const c = chars[i];
      if (/\s/.test(c)) {
        i += 1;
        continue;
      }
      if (c !== wanted[matched]) return null;
      if (from < 0) from = i;
      to = i;
      matched += 1;
      i += 1;
    }
    if (matched < wanted.length) return null;
    spans.push({ from, to, startSec: alignment.startSec[from], endSec: alignment.endSec[to] });
  }
  return spans;
}

/** Append GAP_SEC of silence to a line synthesized on its own, so the per-line
 *  fallback spaces its sentences the way the one-take path does. */
function padSilence(path, ffmpegBin) {
  const tmp = `${path}.pad.mp3`;
  const result = spawnSync(ffmpegBin, ['-y', '-loglevel', 'error', '-i', path,
    '-af', `apad=pad_dur=${GAP_SEC}`, '-c:a', 'libmp3lame', '-q:a', '2', tmp]);
  if (result.status !== 0) {
    throw new Error(`ffmpeg could not pad ${path}`);
  }
  renameSync(tmp, path);
}

/** Cut [startSec, endSec] out of a file and append GAP_SEC of silence. */
function cutSegment(sourcePath, outPath, startSec, endSec, ffmpegBin) {
  const result = spawnSync(ffmpegBin, [
    '-y', '-loglevel', 'error',
    '-ss', String(startSec),
    '-to', String(endSec),
    '-i', sourcePath,
    '-af', `apad=pad_dur=${GAP_SEC}`,
    '-c:a', 'libmp3lame', '-q:a', '2',
    outPath,
  ]);
  if (result.status !== 0) {
    throw new Error(`ffmpeg could not cut ${outPath}: ${result.stderr?.toString().slice(0, 200)}`);
  }
}

export function estimateDurationSec(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_BEAT_SEC, words / WORDS_PER_SEC + TAIL_PAUSE_SEC);
}

function resolveFfmpeg(binary) {
  if (spawnSync(binary, ['-version'], { stdio: 'ignore' }).status === 0) {
    return binary;
  }
  const pkg =
    binary === 'ffprobe' ? '@ffprobe-installer/ffprobe' : '@ffmpeg-installer/ffmpeg';
  try {
    return require(pkg).path;
  } catch {
    return null;
  }
}

export function measureDurationSec(audioPath, ffprobeBin = 'ffprobe') {
  const probe = spawnSync(ffprobeBin, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ]);
  const seconds = Number.parseFloat(probe.stdout?.toString().trim() ?? '');
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`could not measure duration of ${audioPath}`);
  }
  return seconds;
}

const TONE_BURST_SEC = 0.25;

/**
 * Stand-in for a spoken line. Silent by default.
 *
 * With FK_NARRATE_TONE=1 each beat instead opens with a short beep and then
 * falls silent. That turns "the MP4 has an audio track" into a checkable
 * claim: silencedetect on the finished video reports one onset per beat, and
 * those onsets must equal the caption start times. A misplaced audio sequence
 * is indistinguishable from a correct one when every beat is pure silence.
 */
function writeStubAudio(outPath, seconds, ffmpegBin, { tone = false } = {}) {
  const filter = tone
    ? `sine=frequency=660:duration=${TONE_BURST_SEC},apad=whole_dur=${seconds.toFixed(3)}`
    : `anullsrc=r=44100:cl=mono:d=${seconds.toFixed(3)}`;
  const result = spawnSync(ffmpegBin, [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', filter,
    '-t', seconds.toFixed(3),
    '-q:a', '9',
    outPath,
  ]);
  if (result.status !== 0) {
    throw new Error(`ffmpeg could not write stub audio: ${result.stderr?.toString()}`);
  }
}

async function synthesizePlain(text, outPath, { apiKey, voiceId, modelId, stability }) {
  const response = await fetch(`${ELEVENLABS_ENDPOINT}/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: 'nl',
      voice_settings: { stability },
    }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs returned ${response.status} ${response.statusText}`);
  }
  writeFileSync(outPath, Buffer.from(await response.arrayBuffer()));
}

/**
 * One call returns the audio and the character-level alignment, which is what
 * lets captions.mjs cut a long sentence into readable cues instead of parking
 * one nine-second block on screen.
 */
async function synthesize(text, outPath, { apiKey, voiceId, modelId, stability }) {
  const response = await fetch(`${ELEVENLABS_ENDPOINT}/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: 'nl',
      voice_settings: { stability },
    }),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      // Not every model exposes alignment. Losing word-level cues is a
      // downgrade, not a failure: captions fall back to one cue per beat.
      await synthesizePlain(text, outPath, { apiKey, voiceId, modelId, stability });
      return null;
    }
    // Never echo the body wholesale: it can carry account details.
    throw new Error(`ElevenLabs returned ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  writeFileSync(outPath, Buffer.from(payload.audio_base64, 'base64'));
  const a = payload.alignment;
  return a
    ? {
        characters: a.characters,
        startSec: a.character_start_times_seconds,
        endSec: a.character_end_times_seconds,
      }
    : null;
}

function parseArgs(argv) {
  const out = {
    storyboard: null,
    workDir: null,
    voice: null,
    stability: null,
    perBeat: false,
    fresh: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--work') out.workDir = argv[++i];
    else if (a === '--voice') out.voice = argv[++i];
    else if (a === '--stability') out.stability = Number(argv[++i]);
    else if (a === '--per-beat') out.perBeat = true;
    else if (a === '--fresh') out.fresh = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else if (!out.storyboard) out.storyboard = a;
    else {
      console.error(`[narrate] unknown argument: ${a}`);
      out.help = true;
    }
  }
  return out;
}

const isEntrypoint =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.storyboard || !args.workDir) {
    console.error(
      'Usage: narrate.mjs <storyboard.mjs> --work <dir> [--voice <id>]' +
        ' [--stability 0|0.5|1] [--per-beat] [--fresh]',
    );
    process.exit(args.help ? 0 : 1);
  }

  const storyboardPath = isAbsolute(args.storyboard)
    ? args.storyboard
    : resolve(process.cwd(), args.storyboard);
  if (!existsSync(storyboardPath)) {
    console.error(`[narrate] storyboard not found: ${storyboardPath}`);
    process.exit(1);
  }

  const { beats, meta } = await import(pathToFileURL(storyboardPath).href);
  if (!Array.isArray(beats) || beats.length === 0) {
    console.error('[narrate] storyboard exports no beats');
    process.exit(1);
  }

  const workDir = resolve(args.workDir);
  const audioDir = join(workDir, 'audio');
  mkdirSync(audioDir, { recursive: true });

  const ffmpegBin = resolveFfmpeg('ffmpeg');
  const ffprobeBin = resolveFfmpeg('ffprobe');
  if (!ffmpegBin || !ffprobeBin) {
    console.error('[narrate] ffmpeg and ffprobe are required');
    process.exit(1);
  }

  // FK_NARRATE_STUB=1 proves the chain without spending credit, even with a key on disk.
  const apiKey = process.env.FK_NARRATE_STUB === '1' ? null : resolveApiKey();
  const voiceArg = args.voice ?? process.env.ELEVENLABS_VOICE_ID;
  const voiceId = VOICES[voiceArg] ?? voiceArg ?? DEFAULT_VOICE;
  const voiceName = Object.keys(VOICES).find((name) => VOICES[name] === voiceId) ?? null;
  const stability = args.stability ?? VOICE_STABILITY[voiceName] ?? DEFAULT_STABILITY;
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? VOICE_MODEL[voiceName] ?? DEFAULT_MODEL;


  const mode = apiKey
    ? 'elevenlabs'
    : process.env.FK_NARRATE_TONE === '1'
      ? 'tone-stub'
      : 'silent-stub';
  console.log(
    `[narrate] mode ${mode}${apiKey ? ` (voice ${voiceId}, model ${modelId}, stability ${stability})` : ''}`,
  );
  const fkPoDir = resolveFkPoDir();
  // --fresh buys a new take of unchanged text: the model reads it differently
  // every call, and sometimes a different read is the point. The new take
  // replaces the cached one.
  const cacheDir = process.env.FK_TTS_CACHE ?? (fkPoDir ? join(fkPoDir, 'tts-cache') : null);
  const speak = async (text, outPath) => {
    const { alignment, cached } = await cachedSynthesize(
      text,
      outPath,
      { apiKey, voiceId, modelId, stability },
      { cacheDir, synth: synthesize, fresh: args.fresh },
    );
    if (cached) console.log(`[narrate] reused a take from ${cacheDir}, no credit spent`);
    return alignment;
  };

  for (const beat of beats) {
    if (!beat.id) {
      console.error('[narrate] every beat needs an id');
      process.exit(1);
    }
    // Cards are silent, so a narration on one would be a line nobody hears or
    // reads. A screen beat without one has nothing to say.
    if (beat.kind === 'card') {
      if (!beat.cardTitle) {
        console.error(`[narrate] card "${beat.id}" needs a cardTitle`);
        process.exit(1);
      }
    } else if (!beat.narration) {
      console.error(`[narrate] beat "${beat.id}" needs narration`);
      process.exit(1);
    }
  }

  // The caption and the voice are allowed to differ. Dutch stress often needs
  // steering that would look wrong written down: "een" is the article but "één"
  // is the number, and only one of those is correct to read.
  // Cards are silent, Tim's call on 2026-08-25: a full-screen statement is
  // read, not heard, and a voice over it competes with the words on screen.
  // They are left out of the take entirely rather than synthesized and muted,
  // so no credit is spent on audio nobody plays.
  const spoken = beats.map((beat) =>
    beat.kind === 'card' ? null : (beat.speech ?? beat.narration),
  );
  const spokenLines = spoken.filter((line) => line !== null);

  // One request for the whole script, then cut it up. Line by line, the model
  // has no context past the sentence it is given and reads each one slightly
  // differently: same voice, audibly different delivery. Anything that goes
  // wrong here falls back to the per-line path rather than shipping a mixture.
  let spans = null;
  let wholeAudio = null;
  if (apiKey && !args.perBeat) {
    wholeAudio = join(audioDir, '_whole.mp3');
    try {
      const alignment = await speak(spokenLines.join(JOIN), wholeAudio);
      if (!alignment) {
        console.log('[narrate] whole script returned no alignment; falling back to per line');
      } else {
        const located = locateLines(alignment, spokenLines);
        if (located) {
          // Back onto the beat list, which has gaps where the cards are.
          const rebased = located.map((span) => ({
            ...span,
            alignment: {
              characters: alignment.characters.slice(span.from, span.to + 1),
              startSec: alignment.startSec
                .slice(span.from, span.to + 1)
                .map((v) => v - span.startSec),
              endSec: alignment.endSec.slice(span.from, span.to + 1).map((v) => v - span.startSec),
            },
          }));
          let next = 0;
          spans = spoken.map((line) => (line === null ? null : rebased[next++]));
          console.log(`[narrate] one take, ${located.length} spoken lines cut from it`);
        } else {
          console.log('[narrate] could not locate every line in the alignment; per line instead');
        }
      }
    } catch (error) {
      console.log(`[narrate] whole script failed (${error.message}); per line instead`);
    }
  }

  const resolved = [];
  let cursorSec = 0;

  for (const [index, beat] of beats.entries()) {
    const line = spoken[index];
    const silent = line === null;
    const audioPath = join(audioDir, `${beat.id}.mp3`);
    let alignment = null;
    try {
      if (silent) {
        // No file at all: the composition skips a beat without audio, so there
        // is nothing to accidentally play at zero volume.
      } else if (spans) {
        const span = spans[index];
        cutSegment(wholeAudio, audioPath, span.startSec, span.endSec, ffmpegBin);
        alignment = span.alignment;
      } else if (apiKey) {
        alignment = await speak(line, audioPath);
        padSilence(audioPath, ffmpegBin);
      } else {
        writeStubAudio(audioPath, estimateDurationSec(line) + GAP_SEC, ffmpegBin, {
          tone: process.env.FK_NARRATE_TONE === '1',
        });
      }
      const previous = beats[index - 1];
      const leadInSec = !silent && (!previous || previous.kind === 'card') ? LEAD_IN_SEC : 0;
      if (!silent && apiKey) {
        const tight = tightenBeatAudio(audioPath, alignment, ffmpegBin, {
          maxPause: MAX_PAUSE_SEC,
          tailSec: GAP_SEC,
          leadInSec,
        });
        alignment = tight.alignment;
        if (tight.removedSec > 0.05) {
          console.log(`[narrate] ${beat.id}: ${tight.removedSec.toFixed(2)}s of pause removed`);
        }
      } else if (leadInSec > 0) {
        writeStubAudio(audioPath, estimateDurationSec(line) + GAP_SEC + leadInSec, ffmpegBin, {
          tone: false,
        });
      }
    } catch (error) {
      console.error(`[narrate] beat "${beat.id}": ${error.message}`);
      process.exit(5);
    }

    // A beat may be held longer than its line takes to say. A card carrying
    // three words is unreadable if it leaves as soon as the voice stops.
    const spokenSec = silent ? 0 : measureDurationSec(audioPath, ffprobeBin);
    // A card with no design renders as flows (Cards.tsx resolveDesign).
    const cardFloor = DESIGN_MIN_SEC[beat.cardDesign ?? 'flows'] ?? CARD_MIN_SEC;
    const isCard = beat.kind === 'card';
    const wanted = beat.minSec ?? (isCard ? cardFloor : 0);
    const floor = isCard ? wanted : Math.min(wanted, spokenSec + MAX_HOLD_SEC);
    if (floor < wanted) {
      console.log(`[narrate] ${beat.id}: minSec ${wanted}s capped to ${floor.toFixed(2)}s, the voice ends at ${spokenSec.toFixed(2)}s`);
    }
    const durationSec = Math.max(spokenSec, floor);
    resolved.push({
      id: beat.id,
      narration: beat.narration,
      audio: silent ? null : `audio/${beat.id}.mp3`,
      startSec: cursorSec,
      durationSec,
      alignment,
      kind: beat.kind ?? 'screen',
      cardTitle: beat.cardTitle ?? null,
      cardEyebrow: beat.cardEyebrow ?? null,
      cardSubtitle: beat.cardSubtitle ?? null,
      cardVariant: beat.cardVariant ?? null,
      cardDesign: beat.cardDesign ?? null,
      wide: beat.wide ?? false,
      cardStep: beat.cardStep ?? null,
    });
    cursorSec += durationSec;
    const held = durationSec > spokenSec + 0.01 ? ` (held from ${spokenSec.toFixed(2)}s)` : '';
    console.log(`[narrate] ${beat.id.padEnd(18)} ${durationSec.toFixed(2)}s${held}`);
  }

  const beatsJson = join(workDir, 'beats.json');
  writeFileSync(
    beatsJson,
    JSON.stringify(
      {
        mode,
        meta: meta ?? {},
        voice: apiKey ? { name: voiceName, id: voiceId, model: modelId, stability } : null,
        totalSec: cursorSec,
        beats: resolved,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('---');
  console.log(`[narrate] beats  ${beatsJson}`);
  console.log(`[narrate] total  ${cursorSec.toFixed(2)}s across ${resolved.length} beats`);
}

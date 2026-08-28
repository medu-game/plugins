// captions.mjs — WebVTT for the finished help video.
//
// Cue times are on the FINAL timeline, so they include the intro card: the
// capture does not start at zero. The offset comes from remotion/timing.mjs,
// the same file the composition reads, so the two cannot drift apart.
//
// A beat is one spoken sentence, which is often too long to sit on screen as a
// single cue. When ElevenLabs returned character alignment the sentence is cut
// at word boundaries into readable chunks; without it (the silent stub) the
// beat stays one cue, because inventing timings we did not measure would put
// wrong numbers in a file nobody checks.
//
// The timings come from the alignment, which is of the SPOKEN text, but the
// words on screen come from the beat's narration. Those two differ on purpose:
// Dutch stress needs steering the reader should not see, so "een" is spoken as
// "'n" and "enige" as "énige". Taking the cue text from the alignment shipped
// that steering to customers, which is exactly what the split between the two
// fields exists to prevent.

import { INTRO_SEC } from './remotion/timing.mjs';

// Subtitle convention: a cue should be readable in one glance.
const MAX_CUE_CHARS = 80;
const MAX_CUE_SEC = 6;

export function formatTimestamp(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

/**
 * Group an alignment's characters into words carrying their own timings.
 */
export function toWords(alignment) {
  const words = [];
  let current = null;
  alignment.characters.forEach((char, i) => {
    if (/\s/.test(char)) {
      current = null;
      return;
    }
    if (current === null) {
      current = { text: '', startSec: alignment.startSec[i], endSec: alignment.endSec[i] };
      words.push(current);
    }
    current.text += char;
    current.endSec = alignment.endSec[i];
  });
  return words;
}

/**
 * Cut one beat into cues. Times returned are relative to the beat.
 */
export function splitBeat(beat) {
  if (!beat.alignment) {
    return [{ text: beat.narration, startSec: 0, endSec: beat.durationSec }];
  }

  const words = toWords(beat.alignment);
  if (words.length === 0) {
    return [{ text: beat.narration, startSec: 0, endSec: beat.durationSec }];
  }

  // Re-label the timed words with what the viewer should read. The two texts
  // differ only by substitutions, so the counts match; if they ever do not,
  // one cue with the right text beats several with the wrong text.
  const written = beat.narration.trim().split(/\s+/).filter(Boolean);
  if (written.length !== words.length) {
    return [{ text: beat.narration, startSec: 0, endSec: beat.durationSec }];
  }
  words.forEach((word, i) => {
    word.text = written[i];
  });

  const cues = [];
  let current = null;
  for (const word of words) {
    const wouldBeTooLong =
      current !== null &&
      (current.text.length + 1 + word.text.length > MAX_CUE_CHARS ||
        word.endSec - current.startSec > MAX_CUE_SEC);

    if (current === null || wouldBeTooLong) {
      current = { text: word.text, startSec: word.startSec, endSec: word.endSec };
      cues.push(current);
    } else {
      current.text += ` ${word.text}`;
      current.endSec = word.endSec;
    }
  }
  // The last cue holds until the beat ends, so the screen is never blank while
  // the picture still belongs to that sentence.
  cues[cues.length - 1].endSec = Math.max(cues[cues.length - 1].endSec, beat.durationSec);
  return cues;
}

export function buildVtt(beats, offsetSec = INTRO_SEC) {
  const blocks = [];
  let index = 0;
  // A card has no voice, so it has no cue: a subtitle for something nobody says
  // reads as a caption error to anyone who turns them on. Stated as the rule
  // rather than as "has an audio file", because those are not the same claim
  // and the first version silenced every beat in a fixture that omits the field.
  for (const beat of beats.filter((b) => b.kind !== 'card' && b.audio !== null)) {
    for (const cue of splitBeat(beat)) {
      index += 1;
      const start = offsetSec + beat.startSec + cue.startSec;
      const end = offsetSec + beat.startSec + cue.endSec;
      blocks.push(
        [String(index), `${formatTimestamp(start)} --> ${formatTimestamp(end)}`, cue.text].join(
          '\n',
        ),
      );
    }
  }
  return ['WEBVTT', '', ...blocks.flatMap((block) => [block, ''])].join('\n');
}

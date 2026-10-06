// script.mjs — the words a help video puts on screen and in the voice, as the
// PO approves them.
//
// The approval gate in make-help.mjs is a hash of these lines, not a promise in
// SKILL.md. Melissa's 2026-10-05 session shipped a paid take with a sentence an
// edit script had silently failed to change, and two re-runs went to narration
// with no new OK. A paid run now only starts against the hash of the exact text
// she saw.

import { createHash } from 'node:crypto';

// Fenna's measured rate on 2026-10-02: 132 words a minute.
const WORDS_PER_SEC = 2.2;
const CARD_SEC = 4.5;
const INTRO_OUTRO_SEC = 8;

export function scriptLines(beats, meta) {
  const lines = [`Titel: ${meta?.title ?? ''}`];
  if (meta?.subtitle) lines.push(`Ondertitel: ${meta.subtitle}`);
  for (const beat of beats) {
    if (beat.kind === 'card') {
      const sub = beat.cardSubtitle ? ` / ${beat.cardSubtitle}` : '';
      lines.push(`[kaart ${beat.id}] ${beat.cardTitle ?? ''}${sub}`);
    } else {
      lines.push(`[${beat.id}] ${beat.narration ?? ''}`);
      if (beat.speech && beat.speech !== beat.narration) {
        lines.push(`[${beat.id} uitgesproken] ${beat.speech}`);
      }
    }
  }
  return lines;
}

export function scriptHash(lines) {
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 10);
}

export function spokenSec(beat) {
  return (beat.speech ?? beat.narration ?? '').split(/\s+/).filter(Boolean).length / WORDS_PER_SEC;
}

export function estimateSec(beats) {
  let sec = INTRO_OUTRO_SEC;
  for (const beat of beats) {
    if (beat.kind === 'card') sec += CARD_SEC;
    else sec += spokenSec(beat);
  }
  return Math.round(sec);
}

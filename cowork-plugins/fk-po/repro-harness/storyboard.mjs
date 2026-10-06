// storyboard.mjs — the beat runner and prop builder for the help-video pipeline.
//
// A storyboard is a list of beats. Each beat is one spoken sentence plus the
// UI action it describes. narrate.mjs turns the sentences into audio and
// measures how long each takes; this module walks the beats during capture and
// holds each screen for at least that long, so the finished video never moves
// on before the voice has finished the sentence.
//
// Scenarios import runStoryboard(). render.mjs imports buildHelpProps().

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_DESIGNS } from './remotion/card-designs.mjs';

const FOCUS_FILE = 'focus.json';
const PROBE_DIR = 'probe';
const PROBE_REPORT = 'probe/report.json';
// The recording stops the moment the last dwell ends, which lands a fraction
// before the last narration file finishes. Hold a little longer so the video
// covers the voice instead of freezing on its final frame.
const TAIL_PAD_SEC = 0.5;

// What a storyboard author may set on a beat, and what narrate.mjs adds later.
// Split rather than merged because the validator checks an AUTHORED storyboard:
// a beat carrying `durationSec` has been through narrate and is not a source
// file any more. storyboard.test.mjs derives the fields the code actually reads
// and fails if either list drifts from it, because a hand-kept list is the same
// bug in a new place.
export const AUTHORED_BEAT_FIELDS = new Set([
  'id',
  'kind',
  'narration',
  'speech',
  'action',
  'focus',
  'preRollSec',
  'minSec',
  'wide',
  'cardTitle',
  'cardEyebrow',
  'cardSubtitle',
  'cardVariant',
  'cardDesign',
  'cardStep',
]);
export const GENERATED_BEAT_FIELDS = new Set(['audio', 'durationSec', 'alignment']);

const CARD_TEXT_FIELDS = ['cardTitle', 'cardEyebrow', 'cardSubtitle'];
const SPOKEN_TEXT_FIELDS = ['narration', 'speech'];
const EM_DASH = '—';

/**
 * Check a storyboard before anything expensive runs.
 *
 * No browser, no network, no credit: this is the gate that turns a malformed
 * storyboard into a one-second error instead of a recording session and an
 * ElevenLabs bill. Returns every problem at once rather than throwing on the
 * first, so an author gets one corrected version instead of three rounds.
 *
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStoryboard(beats, meta) {
  const errors = [];
  const noEmDash = (where, value) => {
    if (typeof value !== 'string') return;
    if (value.includes(EM_DASH)) {
      errors.push(`${where}: em dash is not allowed in user-facing copy (FE-COPY-1)`);
    }
    // English puts a comma before "and"; Dutch does not, and the voice turns the
    // comma into an audible pause (Melissa, 2026-10-06).
    if (/,\s+en\b/i.test(value)) {
      errors.push(`${where}: no comma before "en" in Dutch copy`);
    }
  };

  for (const key of ['slug', 'title', 'subtitle']) {
    if (!meta?.[key]) errors.push(`meta.${key} is required`);
  }
  // The intro puts both on screen, so they are copy, not identifiers.
  noEmDash('meta.title', meta?.title);
  noEmDash('meta.subtitle', meta?.subtitle);

  if (!Array.isArray(beats) || beats.length === 0) {
    errors.push('beats must be a non-empty array');
    return { ok: errors.length === 0, errors };
  }

  const seen = new Set();
  beats.forEach((beat, index) => {
    const at = beat?.id ? `beat "${beat.id}"` : `beat #${index + 1}`;
    if (!beat?.id) {
      errors.push(`${at}: id is required`);
    } else if (seen.has(beat.id)) {
      errors.push(`${at}: duplicate id; buildHelpProps keys on it`);
    } else {
      seen.add(beat.id);
    }

    for (const field of Object.keys(beat ?? {})) {
      if (AUTHORED_BEAT_FIELDS.has(field)) continue;
      const known = GENERATED_BEAT_FIELDS.has(field)
        ? 'is added by narrate.mjs, not set by hand'
        : 'is read by nothing in the pipeline';
      errors.push(`${at}: ${field} ${known}`);
    }

    if (beat?.kind === 'card') {
      if (!beat.cardTitle) errors.push(`${at}: a card needs cardTitle`);
      if (beat.cardDesign && !CARD_DESIGNS.includes(beat.cardDesign)) {
        errors.push(`${at}: cardDesign "${beat.cardDesign}" is not one of ${CARD_DESIGNS.join(', ')}`);
      }
      // Cards have no voice and no subtitle, so a narration on one is a line
      // nobody hears or reads.
      if (beat.narration || beat.speech) {
        errors.push(`${at}: a card is silent, so it carries no narration or speech`);
      }
      for (const field of CARD_TEXT_FIELDS) noEmDash(`${at}.${field}`, beat[field]);
      return;
    }

    if (!beat?.narration) errors.push(`${at}: a screen beat needs narration`);
    for (const field of SPOKEN_TEXT_FIELDS) noEmDash(`${at}.${field}`, beat?.[field]);
    // runStoryboard only honours preRollSec in the branch that also runs an
    // action, so on its own it silently does nothing.
    if (beat?.preRollSec !== undefined && !beat?.action) {
      errors.push(`${at}: preRollSec does nothing without an action`);
    }
  });

  return { ok: errors.length === 0, errors };
}

export function loadBeats(workDir) {
  const path = join(workDir, 'beats.json');
  if (!existsSync(path)) {
    throw new Error(`no beats.json in ${workDir}; run narrate.mjs first`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Walk the storyboard against a live page, holding each beat for the length of
 * its narration. Writes focus.json (the zoom target per beat) next to the
 * capture; the beat's timing comes from the step events helpers.mjs already
 * logs, so this module never has to agree with events.jsonl about time zero.
 */
export async function runStoryboard({ page, run, beats, narration, workDir }) {
  const durations = new Map(narration.beats.map((b) => [b.id, b.durationSec]));
  const focus = {};

  for (const beat of beats) {
    const durationSec = durations.get(beat.id);
    if (durationSec === undefined) {
      throw new Error(`beat "${beat.id}" has no narration; re-run narrate.mjs`);
    }

    run.step(beat.id);
    const startedAt = Date.now();

    const capture = async () => {
      if (!beat.focus) return;
      const box = await page.locator(beat.focus).first().boundingBox();
      if (box) {
        focus[beat.id] = {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      }
    };

    // A beat that both points at a control and clicks it has to let the camera
    // arrive first, or the viewer is told to press a button that was already
    // pressed. The focus box then has to be read before the click too, because
    // clicking is usually what makes it move or disappear.
    if (beat.preRollSec && beat.action) {
      await capture();
      await page.waitForTimeout(beat.preRollSec * 1000);
      await beat.action({ page, run });
    } else if (beat.action) {
      await beat.action({ page, run });
      await capture();
    } else {
      await capture();
    }

    const remainingMs = durationSec * 1000 - (Date.now() - startedAt);
    if (remainingMs > 0) await page.waitForTimeout(remainingMs);
  }

  await page.waitForTimeout(TAIL_PAD_SEC * 1000);

  if (workDir) {
    writeFileSync(join(workDir, FOCUS_FILE), JSON.stringify(focus, null, 2), 'utf8');
  }
  return focus;
}

/**
 * Walk a storyboard without narration, screenshotting every screen beat.
 *
 * The point is to spend a browser instead of ElevenLabs credit: a selector that
 * no longer matches shows up here, before a word is synthesised. Deliberately a
 * second walk in this file rather than a copy of runStoryboard elsewhere, so the
 * two cannot drift about what a beat means.
 *
 * Differs from runStoryboard in three ways: no durations (a fixed short dwell),
 * a screenshot instead of a hold, and a failure is COLLECTED rather than thrown,
 * so one run reports every broken selector instead of stopping at the first.
 */
export async function dryRunStoryboard({ page, run, beats, meta, workDir, dwellMs = 400 }) {
  const probeDir = join(workDir, PROBE_DIR);
  mkdirSync(probeDir, { recursive: true });
  const report = { slug: meta?.slug ?? null, ok: true, beats: [], failures: [] };

  for (const beat of beats) {
    // A card has no UI to walk or screenshot, but runStoryboard runs its action
    // like any other beat, and a card is exactly where a slow state change gets
    // parked (see the replacements card in verlof-aanvragen). Skipping the action
    // here left the wizard a step behind for every beat after it, and the probe
    // reported those as unresolved selectors: a real failure pointing at the
    // wrong thing. Same beat semantics as the recording, or the gate is a lie.
    if (beat.kind === 'card') {
      const entry = { id: beat.id, kind: 'card', actionRan: false };
      if (beat.action) {
        try {
          await beat.action({ page, run });
          entry.actionRan = true;
        } catch (error) {
          entry.error = error.message;
          report.failures.push({ id: beat.id, selector: null, reason: error.message });
          report.ok = false;
        }
      }
      report.beats.push(entry);
      continue;
    }

    const entry = { id: beat.id, kind: 'screen', actionRan: false, focusResolved: false };
    run.step(beat.id);

    const resolveFocus = async () => {
      if (!beat.focus) return;
      const box = await page.locator(beat.focus).first().boundingBox();
      if (!box) throw new Error('focus box could not be measured');
      entry.focusResolved = true;
      entry.focusBox = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };

    try {
      // Same ordering rule as runStoryboard: a beat whose action removes its own
      // focus target has to be measured first, which is what preRollSec means.
      const actionStarted = Date.now();
      if (beat.preRollSec && beat.action) {
        await resolveFocus();
        await beat.action({ page, run });
      } else if (beat.action) {
        await beat.action({ page, run });
        await resolveFocus();
      } else {
        await resolveFocus();
      }
      entry.actionRan = Boolean(beat.action);
      // What the recording will spend on this beat before the voice can be the
      // only thing setting its length. The probe skips the pre-roll wait, the
      // recording does not.
      if (beat.action) {
        entry.actionSec = Number(((Date.now() - actionStarted) / 1000 + (beat.preRollSec ?? 0)).toFixed(1));
      }
    } catch (error) {
      entry.error = error.message;
      report.failures.push({
        id: beat.id,
        selector: beat.focus ?? null,
        reason: error.message,
      });
      report.ok = false;
    }

    await page.waitForTimeout(dwellMs);
    const shot = join(PROBE_DIR, `${beat.id}.png`);
    await page.screenshot({ path: join(workDir, shot) });
    entry.screenshot = shot;
    report.beats.push(entry);
  }

  writeFileSync(join(workDir, PROBE_REPORT), JSON.stringify(report, null, 2), 'utf8');
  return report;
}

export function loadFocus(workDir) {
  const path = join(workDir, FOCUS_FILE);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

/**
 * Turn the recorded events plus the narration manifest into HelpVideo props.
 *
 * Beat start times come from the OBSERVED step events, not from the planned
 * cumulative durations: capture drifts, and anchoring the audio to what the
 * recording actually did is what keeps voice and picture together.
 */
export function buildHelpProps(events, narration, focus, meta) {
  const last = events[events.length - 1];
  const byId = new Map(narration.beats.map((b) => [b.id, b]));
  const beatEvents = events.filter((e) => e.kind === 'step' && byId.has(e.label));

  // Everything before the first beat is setup, typically the login. The viewer
  // is already signed in, so the finished video starts at the first beat and
  // the composition trims that head off the capture.
  const offsetSec = beatEvents.length > 0 ? beatEvents[0].t / 1000 : 0;

  const beats = beatEvents.map((e) => {
    const beat = byId.get(e.label);
    return {
      id: beat.id,
      narration: beat.narration,
      audio: beat.audio,
      startSec: e.t / 1000 - offsetSec,
      durationSec: beat.durationSec,
      alignment: beat.alignment ?? null,
      focus: focus[beat.id] ?? null,
      kind: beat.kind ?? 'screen',
      cardTitle: beat.cardTitle ?? null,
      cardEyebrow: beat.cardEyebrow ?? null,
      cardSubtitle: beat.cardSubtitle ?? null,
      cardVariant: beat.cardVariant ?? null,
      cardDesign: beat.cardDesign ?? null,
      wide: beat.wide ?? false,
      cardStep: beat.cardStep ?? null,
    };
  });

  return {
    title: meta.title,
    subtitle: meta.subtitle ?? '',
    captureStartSec: offsetSec,
    // Ends with the last beat, not with the recording: runStoryboard records
    // TAIL_PAD_SEC past it as headroom, and in the edit that showed the app
    // again between a closing card and the outro (Melissa, 2026-09-13).
    captureDurationSec:
      beats.length > 0
        ? beats[beats.length - 1].startSec + beats[beats.length - 1].durationSec
        : (last?.t ?? 0) / 1000 - offsetSec,
    beats,
    clicks: events
      .filter((e) => e.kind === 'click' && e.t / 1000 >= offsetSec)
      .map((e) => ({ atSec: e.t / 1000 - offsetSec, x: e.x, y: e.y })),
  };
}

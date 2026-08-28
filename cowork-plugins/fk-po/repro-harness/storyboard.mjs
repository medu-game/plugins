// storyboard.mjs — the beat runner and prop builder for the help-video pipeline.
//
// A storyboard is a list of beats. Each beat is one spoken sentence plus the
// UI action it describes. narrate.mjs turns the sentences into audio and
// measures how long each takes; this module walks the beats during capture and
// holds each screen for at least that long, so the finished video never moves
// on before the voice has finished the sentence.
//
// Scenarios import runStoryboard(). render.mjs imports buildHelpProps().

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FOCUS_FILE = 'focus.json';
// The recording stops the moment the last dwell ends, which lands a fraction
// before the last narration file finishes. Hold a little longer so the video
// covers the voice instead of freezing on its final frame.
const TAIL_PAD_SEC = 0.5;

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
    captureDurationSec: (last?.t ?? 0) / 1000 - offsetSec,
    beats,
    clicks: events
      .filter((e) => e.kind === 'click' && e.t / 1000 >= offsetSec)
      .map((e) => ({ atSec: e.t / 1000 - offsetSec, x: e.x, y: e.y })),
  };
}

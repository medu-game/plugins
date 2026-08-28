// Pure event-log plumbing for the repro pipeline. The scenario writes events
// while Playwright records video; buildProps() turns them into the props the
// ReproVideo Remotion template consumes. Times are ms relative to the first
// logged event (which helpers.mjs emits right after video recording starts).
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createEventLog(filePath, now = Date.now) {
  mkdirSync(dirname(filePath), { recursive: true });
  let t0 = null;
  return {
    log(kind, data = {}) {
      const at = now();
      if (t0 === null) t0 = at;
      appendFileSync(
        filePath,
        `${JSON.stringify({ kind, t: at - t0, ...data })}\n`,
        'utf8',
      );
    },
    finish() {
      this.log('end');
    },
  };
}

export function parseEvents(jsonlText) {
  return jsonlText
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.trim() !== '')
    .map(({ line, i }) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`events.jsonl: invalid JSON on line ${i + 1}`);
      }
    });
}

export function buildProps(events, meta) {
  const last = events[events.length - 1];
  const bug = events.find((e) => e.kind === 'bug');
  return {
    title: meta.title,
    env: meta.env,
    date: meta.date,
    ticket: meta.ticket ?? null,
    captureDurationSec: (last?.t ?? 0) / 1000,
    steps: events
      .filter((e) => e.kind === 'step')
      .map((e) => ({ startSec: e.t / 1000, label: e.label })),
    clicks: events
      .filter((e) => e.kind === 'click')
      .map((e) => ({ atSec: e.t / 1000, x: e.x, y: e.y })),
    bugMomentSec: bug ? bug.t / 1000 : null,
  };
}

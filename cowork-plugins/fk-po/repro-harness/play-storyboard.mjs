// play-storyboard.mjs — the one scenario every help video runs.
//
// record-repro.mjs launches this as the scenario; it reads which storyboard to
// play from FK_STORYBOARD. There is deliberately no per-video scenario file:
// the storyboard is the only thing an author (or later, the agent) writes.
//
//   FK_STORYBOARD=storyboards/taak-aanmaken.mjs \
//     node record-repro.mjs play-storyboard.mjs --work <dir>

import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HELP_VIEWPORT, loadAppEnv, startRun } from './helpers.mjs';
import { loadBeats, runStoryboard } from './storyboard.mjs';

// Before the storyboard is imported, not after: a storyboard reads the keys it
// needs off process.env at module scope, so anything loaded later arrives too
// late to be seen.
loadAppEnv();

const storyboardArg = process.env.FK_STORYBOARD;
if (!storyboardArg) {
  console.error('[play] FK_STORYBOARD is not set');
  process.exit(1);
}

const workDir = process.env.REPRO_RECORD_DIR;
if (!workDir) {
  console.error('[play] REPRO_RECORD_DIR is not set; run this through record-repro.mjs');
  process.exit(1);
}

const storyboardPath = isAbsolute(storyboardArg)
  ? storyboardArg
  : resolve(process.cwd(), storyboardArg);
const { beats, meta, setup } = await import(pathToFileURL(storyboardPath).href);

const narration = loadBeats(workDir);
// A storyboard may name the account it has to be recorded as. Left unset it
// stays on the bug-video account, so nothing that worked before changes.
const { page, run } = await startRun({
  name: meta?.slug ?? 'help',
  account: meta?.account ?? 'acc',
  viewport: HELP_VIEWPORT,
});

try {
  if (setup) await setup({ page, run, workDir });
  await runStoryboard({ page, run, beats, narration, workDir });
} finally {
  await run.finish();
}

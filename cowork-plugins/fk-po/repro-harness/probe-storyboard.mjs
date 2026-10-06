// probe-storyboard.mjs — the dry run that gates the spend.
//
// Walks a storyboard in a real browser with no narration and no render, and
// screenshots every screen beat. A selector that no longer matches surfaces
// here, before a word of ElevenLabs credit is spent and before a recording
// session is booked. Mirrors play-storyboard.mjs on purpose: same login, same
// account, same beat semantics. A probe that logs in differently is a probe that
// can pass while the recording fails.
//
//   FK_STORYBOARD=storyboards/taak-aanmaken.mjs \
//     node record-repro.mjs probe-storyboard.mjs --work <dir>
//
// Exit codes:
//   0  every selector resolved
//   1  usage or setup error (a malformed storyboard included)
//   3  the walk finished but at least one selector did not resolve

import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HELP_VIEWPORT, loadAppEnv, startRun } from './helpers.mjs';
import { dryRunStoryboard, validateStoryboard } from './storyboard.mjs';

// Before the storyboard is imported, not after: a storyboard reads the keys it
// needs off process.env at module scope, so anything loaded later arrives too
// late to be seen.
loadAppEnv();

const storyboardArg = process.env.FK_STORYBOARD;
if (!storyboardArg) {
  console.error('[probe] FK_STORYBOARD is not set');
  process.exit(1);
}

const workDir = process.env.REPRO_RECORD_DIR;
if (!workDir) {
  console.error('[probe] REPRO_RECORD_DIR is not set; run this through record-repro.mjs');
  process.exit(1);
}

const storyboardPath = isAbsolute(storyboardArg)
  ? storyboardArg
  : resolve(process.cwd(), storyboardArg);
const { beats, meta, setup } = await import(pathToFileURL(storyboardPath).href);

// Cheapest gate first: a schema error costs a second here and a browser session
// if it is left to the walk.
const check = validateStoryboard(beats, meta);
if (!check.ok) {
  console.error(`[probe] ${storyboardPath} is not a valid storyboard:`);
  for (const error of check.errors) console.error(`  - ${error}`);
  process.exit(1);
}

const { page, run } = await startRun({
  name: `probe-${meta?.slug ?? 'help'}`,
  account: meta?.account ?? 'acc',
  viewport: HELP_VIEWPORT,
});

let report;
try {
  if (setup) await setup({ page, run, workDir });
  report = await dryRunStoryboard({ page, run, beats, meta, workDir });
} finally {
  await run.finish();
}

const walked = report.beats.filter((b) => b.kind === 'screen');
console.log(`[probe] ${walked.length} screen beats walked, ${report.failures.length} unresolved`);
for (const beat of walked) {
  const mark = beat.error ? 'FAIL' : 'ok  ';
  console.log(`[probe] ${mark} ${beat.id.padEnd(18)} ${beat.screenshot}`);
}
for (const failure of report.failures) {
  console.error(`[probe] ${failure.id}: ${failure.reason} (selector: ${failure.selector})`);
}
console.log(`[probe] report ${workDir}/probe/report.json`);

// Every failure is reported, then one exit code: the author gets a single
// corrected storyboard rather than three rounds of one fix each.
process.exit(report.ok ? 0 : 3);

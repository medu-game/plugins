// Feasibility gate + pipeline smoke. Proves the current machine (dev sandbox
// or Melissa's Cowork VM) can: launch Playwright Chromium, record video,
// encode with ffmpeg, and render the ReproVideo Remotion template.
// No credentials, no app access: the scenario drives a local file:// page.
//
// Run via `npm run spike`. Prints one PASS/FAIL line per stage; exits
// non-zero on any failure.
import { mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'spike-'));
let failed = false;

function stage(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

// Stage 1: capture a synthetic scenario (Chromium launch + video + ffmpeg).
const scenario = join(work, 'scenario.mjs');
writeFileSync(
  scenario,
  `
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startRun } from ${JSON.stringify(join(here, 'helpers.mjs'))};
const html = join(${JSON.stringify(work)}, 'p.html');
writeFileSync(html, '<style>button{font-size:2rem;margin:4rem}</style><button id="a" onclick="this.textContent=String.fromCharCode(66,82,79,75,69,78)">Test button</button>');
const { page, run } = await startRun({ name: 'spike' });
await page.goto(pathToFileURL(html).href);
run.step('Open the test page');
await run.click('#a', 'Click the test button');
run.markBug('Button shows BROKEN');
await page.waitForTimeout(800);
await run.finish();
`,
);

stage('capture (Playwright Chromium + recordVideo + ffmpeg encode)', () => {
  const r = spawnSync(
    'node',
    [join(here, 'record-repro.mjs'), scenario, '--work', join(work, 'cap')],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`record-repro exited ${r.status}`);
  if (statSync(join(work, 'cap', 'raw.mp4')).size < 5_000) {
    throw new Error('raw.mp4 suspiciously small');
  }
});

// Stage 2: Remotion render of the real template.
stage('render (Remotion ReproVideo via Playwright Chromium)', () => {
  const r = spawnSync(
    'node',
    [
      join(here, 'render.mjs'),
      '--work', join(work, 'cap'),
      '--title', 'Spike check',
      '--out', join(work, 'out'),
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`render exited ${r.status}`);
  const mp4 = readdirSync(join(work, 'out')).find((f) => f.endsWith('.mp4'));
  if (!mp4) throw new Error('no MP4 produced');
  if (statSync(join(work, 'out', mp4)).size < 20_000) {
    throw new Error('final MP4 suspiciously small');
  }
});

console.log(
  failed
    ? '--- SPIKE FAILED: this machine cannot run the pipeline.'
    : `--- SPIKE OK. Artifacts in ${work}`,
);
process.exit(failed ? 1 : 0);

// make-help.mjs — one command for a help video.
//
// Usage: node make-help.mjs <storyboard.mjs> [--probe] [--approved <hash>] [--fresh]
//                           [--voice fenna|man|vrouw]
//
//   --probe  validate, then walk the route in a browser and screenshot every
//            beat into .fk-po/work/<slug>/probe-N. No voice, no render. Prints
//            the script and its hash, and writes both to script.txt.
//   (none)   validate, narrate, record and render into .fk-po/work/<slug>/run-N.
//            Refuses (exit 2) unless --approved matches the hash of the current
//            script: the PO approves exact words, and a later edit voids the OK.
//            Narration reuses a take from .fk-po/tts-cache when the spoken text
//            is unchanged, so only a text change costs credit. --fresh buys a
//            new take anyway, for when the read itself was the problem.
//
// A fresh numbered dir per attempt, so two runs never share a recording. For a
// look-only change, render an existing run instead: npm run render -- --work <dir>.
//
// Exits with the failing stage's own code.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateStoryboard } from './storyboard.mjs';
import { nextRunDir, resolveFkPoDir } from './fk-po-dir.mjs';
import { estimateSec, scriptHash, scriptLines, spokenSec } from './script.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const probe = argv.includes('--probe');
const fresh = argv.includes('--fresh');
const valueOf = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : null);
const voice = valueOf('--voice');
const approved = valueOf('--approved');
const valueAt = new Set(['--voice', '--approved'].map((f) => argv.indexOf(f) + 1).filter((i) => i > 0));
const positional = argv.filter((a, i) => !a.startsWith('--') && !valueAt.has(i));
if (positional.length !== 1 || argv.includes('-h') || argv.includes('--help')) {
  console.error(
    'Usage: make-help.mjs <storyboard.mjs> [--probe] [--approved <hash>] [--fresh] [--voice fenna|man|vrouw]',
  );
  process.exit(positional.length === 1 ? 0 : 1);
}

const storyboard = resolve(positional[0]);
if (!existsSync(storyboard)) {
  console.error(`[make] storyboard not found: ${storyboard}`);
  process.exit(1);
}

// A tracked file changed in this checkout makes the daily `git pull --ff-only`
// refuse, silently: the harness then stays on the version it had. That happened
// with studio-props.json (fixed 2026-09-01) and with a hand-edited tweaks.ts.
const dirty = spawnSync('git', ['-C', here, 'status', '--porcelain', '--untracked-files=no', '--', '.'], {
  encoding: 'utf8',
});
if (dirty.status === 0 && dirty.stdout.trim()) {
  console.warn('[make] WARNING: the harness has local changes, so the daily git pull cannot update it:');
  for (const line of dirty.stdout.trim().split('\n')) console.warn(`  ${line}`);
  console.warn('[make] see melissa-setup.md, "Wat doen bij foutmeldingen", before recording.');
}

// The daily pull runs at 08:00 on weekdays; a fix pushed later that day, or a
// pull that failed, leaves her recording with yesterday's harness without a
// sign. A bounded fetch, so being offline costs seconds and not the run.
const fetched = spawnSync('git', ['-C', here, 'fetch', '--quiet', 'origin', 'main'], {
  encoding: 'utf8',
  timeout: 20_000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
});
if (fetched.status === 0) {
  const behind = spawnSync('git', ['-C', here, 'rev-list', '--count', 'HEAD..FETCH_HEAD'], { encoding: 'utf8' });
  const count = Number(behind.stdout?.trim() ?? 0);
  if (count > 0) {
    console.warn(`[make] WARNING: the harness is ${count} commit(s) behind Bitbucket. Update it first:`);
    console.warn(`  git -C "${here}" pull --ff-only`);
  }
} else {
  console.warn('[make] could not check Bitbucket for a newer harness; continuing with this one');
}

const { beats, meta } = await import(pathToFileURL(storyboard).href);
const check = validateStoryboard(beats, meta);
if (!check.ok) {
  console.error(`[make] ${storyboard} is not a valid storyboard:`);
  for (const error of check.errors) console.error(`  - ${error}`);
  process.exit(1);
}

const lines = scriptLines(beats, meta);
const hash = scriptHash(lines);
const estimate = estimateSec(beats);
const scriptText = [...lines, '', `Geschatte lengte: ${estimate}s`, `Script-hash: ${hash}`].join('\n');

if (!probe && approved !== hash) {
  console.error(
    approved
      ? `[make] --approved ${approved} does not match this script (${hash}); it changed since she approved it.`
      : '[make] a paid run needs --approved <hash>: show her this exact script first.',
  );
  console.error(scriptText);
  process.exit(2);
}

const fkPoDir = resolveFkPoDir();
if (!fkPoDir) {
  console.error('[make] no .fk-po directory found (~/FlowKeeper/.fk-po); see melissa-setup.md');
  process.exit(1);
}
const workDir = nextRunDir(join(fkPoDir, 'work', meta.slug), probe ? 'probe' : 'run');
console.log(`[make] work dir ${workDir}`);

function stage(name, args, env = {}) {
  console.log(`[make] ---- ${name}`);
  const result = spawnSync('node', args, {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  const code = result.status ?? 1;
  if (code !== 0) {
    console.error(`[make] ${name} failed (exit ${code}); artifacts kept in ${workDir}`);
    process.exit(code);
  }
}

const withStoryboard = { FK_STORYBOARD: storyboard };

if (probe) {
  stage('probe', ['record-repro.mjs', 'probe-storyboard.mjs', '--work', workDir], withStoryboard);
  writeFileSync(join(workDir, 'script.txt'), `${scriptText}\n`, 'utf8');
  console.log(`[make] screenshots ${join(workDir, 'probe')}`);
  console.log(`[make] ---- script for her approval (${join(workDir, 'script.txt')})`);
  console.log(scriptText);
  if (estimate > 75) console.log(`[make] estimated ${estimate}s, over the 75s house length; offer to split it`);
  // An action that outlasts its sentence is a silence in the video: the
  // recording waits for the action, the voice has already stopped.
  const reportPath = join(workDir, 'probe', 'report.json');
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    for (const entry of report.beats ?? []) {
      const beat = beats.find((b) => b.id === entry.id);
      if (!beat || beat.kind === 'card' || !entry.actionSec) continue;
      const speechSec = spokenSec(beat);
      if (entry.actionSec > speechSec + 1.5) {
        console.log(
          `[make] ${beat.id}: the clicks take ${entry.actionSec}s, the sentence about ${speechSec.toFixed(1)}s; ` +
            `about ${(entry.actionSec - speechSec).toFixed(1)}s of silence. Shorten the waits in its action, or say more.`,
        );
      }
    }
  }
  process.exit(0);
}

stage('narrate', [
  'narrate.mjs', storyboard, '--work', workDir,
  ...(fresh ? ['--fresh'] : []),
  ...(voice ? ['--voice', voice] : []),
]);
stage('record', ['record-repro.mjs', 'play-storyboard.mjs', '--work', workDir], withStoryboard);
stage('render', ['render-help.mjs', '--work', workDir]);
console.log(`[make] done; restage this run for the studio with: npm run studio -- --work ${workDir}`);

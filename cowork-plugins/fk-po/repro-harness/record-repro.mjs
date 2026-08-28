// record-repro.mjs — capture stage of the PO bug-repro pipeline.
//
// Usage: node record-repro.mjs <scenario.mjs> --work <dir>
//
// Runs the scenario as a child process with REPRO_RECORD_DIR/REPRO_EVENTS_FILE
// set so helpers.mjs records a webm per page plus events.jsonl into the work
// dir, then re-encodes the webm(s) into raw.mp4 (Playwright webms lack
// duration metadata; the re-encode fixes that for Remotion) and writes
// capture.json for render.mjs.
//
// Differences from scripts/sandbox-e2e/record-scenario.mjs (its ancestor):
//   - no --ticket and no GIF here (render.mjs makes the GIF from the final video)
//   - output is a work dir consumed by render.mjs, not a /screenshots evidence file
//
// Exit code mirrors the scenario's. Artifacts are kept either way: a failed
// repro still yields screenshots for the clarification loop with the PO.

import {
  rmSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';

function parseArgs(argv) {
  const out = { positional: [], workDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--work') {
      out.workDir = argv[++i];
    } else if (a === '-h' || a === '--help') {
      out.help = true;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.positional.length !== 1 || !args.workDir) {
  console.error('Usage: record-repro.mjs <scenario.mjs> --work <dir>');
  process.exit(args.help ? 0 : 1);
}

const scenarioPath = isAbsolute(args.positional[0])
  ? args.positional[0]
  : resolve(process.cwd(), args.positional[0]);
try {
  statSync(scenarioPath);
} catch {
  console.error(`[record] scenario not found: ${scenarioPath}`);
  process.exit(1);
}

const workDir = resolve(args.workDir);
mkdirSync(workDir, { recursive: true });
const eventsFile = join(workDir, 'events.jsonl');
// The event log is appended to, so a second recording into the same work dir
// would stack its beats on top of the first run's and every timestamp after
// the join would be wrong. Start each capture from an empty log.
rmSync(eventsFile, { force: true });
// Same for the webms, and this one is worse because it fails quietly. Playwright
// names each recording after its page, so a second run adds a file rather than
// replacing one, and the concat below then splices every session it finds into
// one raw.mp4. Measured: three attempts in one work dir produced a 3m10s video
// for a 56s session, and the composition placed every beat against a picture
// that was minutes behind. Nothing errored.
for (const stale of readdirSync(workDir).filter((f) => f.endsWith('.webm'))) {
  rmSync(join(workDir, stale), { force: true });
}

console.log(`[record] scenario : ${scenarioPath}`);
console.log(`[record] work dir : ${workDir}`);

const child = spawnSync('node', [scenarioPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    REPRO_RECORD_DIR: workDir,
    REPRO_EVENTS_FILE: eventsFile,
  },
});
const scenarioExitCode = child.status ?? (child.error ? 1 : 0);
if (child.error) {
  console.error(`[record] scenario error: ${child.error.message}`);
}

const webms = readdirSync(workDir)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => ({ path: join(workDir, f), mtime: statSync(join(workDir, f)).mtimeMs }))
  .sort((a, b) => a.mtime - b.mtime);

if (webms.length === 0) {
  console.error(
    '[record] no .webm produced; did the scenario call run.finish()?',
  );
  process.exit(scenarioExitCode || 1);
}

// Resolve ffmpeg: system binary first, static npm build as fallback.
const FFMPEG_BIN = await (async () => {
  const probe = spawnSync('ffmpeg', ['-version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (probe.status === 0) return 'ffmpeg';
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
})();

function runFfmpeg(ffArgs, label) {
  const r = spawnSync(FFMPEG_BIN, ffArgs, {
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  if (r.status !== 0) {
    const stderr = r.stderr?.toString() ?? '';
    throw new Error(
      `[record] ffmpeg ${label} failed (exit ${r.status}):\n${stderr.split('\n').slice(-20).join('\n')}`,
    );
  }
}

const rawMp4 = join(workDir, 'raw.mp4');
const encodeArgs = [
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-crf', '23',
  '-preset', 'veryfast',
  '-r', '30',
  '-an',
  rawMp4,
];

try {
  if (webms.length === 1) {
    runFfmpeg(['-y', '-i', webms[0].path, ...encodeArgs], 'webm->mp4');
  } else {
    const listPath = join(workDir, 'concat.txt');
    writeFileSync(
      listPath,
      webms
        .map((w) => `file '${w.path.replace(/'/g, "'\\''")}'`)
        .join('\n') + '\n',
      'utf8',
    );
    runFfmpeg(
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, ...encodeArgs],
      'webm-concat->mp4',
    );
  }
} catch (err) {
  console.error(err.message);
  process.exit(scenarioExitCode || 1);
}

const screenshots = readdirSync(workDir)
  .filter((f) => f.endsWith('.png'))
  .map((f) => join(workDir, f));

writeFileSync(
  join(workDir, 'capture.json'),
  JSON.stringify(
    {
      rawMp4,
      eventsFile,
      screenshots,
      scenarioExitCode,
    },
    null,
    2,
  ),
  'utf8',
);

console.log('---');
console.log(`[record] raw MP4 ${rawMp4} (${Math.round(statSync(rawMp4).size / 1024)} KB)`);
console.log(`[record] events  ${eventsFile}`);
if (scenarioExitCode !== 0) {
  console.log(`[record] scenario exited ${scenarioExitCode}; artifacts kept for diagnosis`);
}
process.exit(scenarioExitCode);

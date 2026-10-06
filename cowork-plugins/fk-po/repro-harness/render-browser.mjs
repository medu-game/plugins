// render-browser.mjs — which Chromium Remotion renders with.
//
// Remotion needs a browser, and two are reachable from here. Playwright's
// Chromium is already on disk because the harness records with it, so using it
// avoids a second ~150MB download. Remotion also ships its own headless shell,
// which it fetches on first use.
//
// Neither works everywhere, and both failure modes are measured:
//
//   macOS, skill run from Claude Desktop, 2026-08-28: Playwright's Chromium
//   stopped loading the Remotion root and kept doing so, including on an older
//   recording that had rendered fine earlier the same evening. Remotion's own
//   shell rendered it on the first try.
//
//   Linux sandbox container: Remotion's shell is not downloaded (no
//   ~/.cache/remotion), so preferring it there turns the first render into a
//   download, on a machine whose network may not allow one. Playwright's
//   Chromium is present and has always worked.
//
// Hence a per-platform default rather than one winner, and a retry with the
// other browser when a render fails. The retry costs a second failed render
// when the real cause was something else entirely (bad props, a missing asset).
// That is deliberate: a render only fails rarely, and the second attempt is
// what tells you the browser was not the problem.
//
// FK_RENDER_BROWSER overrides the choice: "remotion", "playwright", or an
// explicit path to a Chromium binary. An override is taken at its word and gets
// no fallback, because the point of setting it is to pin one browser.

async function playwrightExecutable() {
  try {
    const { chromium } = await import('playwright');
    return chromium.executablePath();
  } catch {
    return null;
  }
}

/**
 * Ordered render attempts. Each carries the extra CLI arguments to pass to
 * `remotion render`; Remotion uses its own shell when no --browser-executable
 * is given.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [platform]
 * @returns {Promise<{ label: string, args: string[] }[]>}
 */
export async function renderBrowserPlan(env = process.env, platform = process.platform) {
  const remotionShell = { label: "Remotion's own headless shell", args: [] };
  const playwrightOf = (path) => ({
    label: `Playwright Chromium (${path})`,
    args: [`--browser-executable=${path}`],
  });

  const override = (env.FK_RENDER_BROWSER ?? '').trim();
  if (override === 'remotion') return [remotionShell];
  if (override === 'playwright') {
    const path = await playwrightExecutable();
    if (!path) throw new Error('FK_RENDER_BROWSER=playwright but Playwright has no Chromium installed');
    return [playwrightOf(path)];
  }
  if (override) return [playwrightOf(override)];

  const path = await playwrightExecutable();
  if (!path) return [remotionShell];
  return platform === 'darwin'
    ? [remotionShell, playwrightOf(path)]
    : [playwrightOf(path), remotionShell];
}

/**
 * Run `remotion render` against each browser in turn until one succeeds.
 *
 * @param {object} params
 * @param {string[]} params.args - the render arguments, minus the browser flag
 * @param {object} params.spawnOptions - passed straight to spawnSync
 * @param {(msg: string) => void} params.log
 * @param {typeof import('node:child_process').spawnSync} params.spawnSync
 * @param {NodeJS.ProcessEnv} [params.env]
 * @returns {Promise<import('node:child_process').SpawnSyncReturns<Buffer>>}
 */
export async function renderWithBrowserFallback({ args, spawnOptions, log, spawnSync, env }) {
  const plan = await renderBrowserPlan(env);
  let result;
  for (const [index, attempt] of plan.entries()) {
    log(`browser : ${attempt.label}`);
    result = spawnSync('npx', [...args, ...attempt.args], spawnOptions);
    if (result.status === 0) return result;
    const next = plan[index + 1];
    if (next) log(`render failed on ${attempt.label}, retrying with ${next.label}`);
  }
  return result;
}

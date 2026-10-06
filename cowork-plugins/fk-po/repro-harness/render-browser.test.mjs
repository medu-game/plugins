import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrowserPlan, renderWithBrowserFallback } from './render-browser.mjs';

const isRemotionShell = (attempt) => attempt.args.length === 0;
const isPlaywright = (attempt) => attempt.args.some((a) => a.startsWith('--browser-executable='));

test('linux tries the Chromium already on disk first', async () => {
  const plan = await renderBrowserPlan({}, 'linux');
  assert.equal(plan.length, 2);
  assert.ok(isPlaywright(plan[0]));
  assert.ok(isRemotionShell(plan[1]));
});

test("macOS tries Remotion's own shell first", async () => {
  // Playwright's Chromium is what failed there, so leading with it costs a full
  // failed render before the fallback gets a turn.
  const plan = await renderBrowserPlan({}, 'darwin');
  assert.equal(plan.length, 2);
  assert.ok(isRemotionShell(plan[0]));
  assert.ok(isPlaywright(plan[1]));
});

test('an override pins one browser and gets no fallback', async () => {
  const remotion = await renderBrowserPlan({ FK_RENDER_BROWSER: 'remotion' }, 'darwin');
  assert.equal(remotion.length, 1);
  assert.ok(isRemotionShell(remotion[0]));

  const playwright = await renderBrowserPlan({ FK_RENDER_BROWSER: 'playwright' }, 'linux');
  assert.equal(playwright.length, 1);
  assert.ok(isPlaywright(playwright[0]));
});

test('an override that is a path is passed through as the executable', async () => {
  const plan = await renderBrowserPlan({ FK_RENDER_BROWSER: '/opt/chrome' }, 'linux');
  assert.deepEqual(plan.map((a) => a.args), [['--browser-executable=/opt/chrome']]);
});

test('a failed render is retried with the other browser', async () => {
  const calls = [];
  const spawnSync = (_cmd, args) => {
    calls.push(args.at(-1));
    return { status: calls.length === 1 ? 1 : 0 };
  };
  const result = await renderWithBrowserFallback({
    args: ['remotion', 'render'],
    spawnOptions: {},
    log: () => {},
    spawnSync,
    env: {},
  });
  assert.equal(result.status, 0);
  assert.equal(calls.length, 2, 'the second browser should have been tried');
  assert.notEqual(calls[0], calls[1], 'the retry must not reuse the browser that just failed');
});

test('a render that succeeds first time does not run twice', async () => {
  let calls = 0;
  const spawnSync = () => {
    calls += 1;
    return { status: 0 };
  };
  await renderWithBrowserFallback({
    args: ['remotion', 'render'],
    spawnOptions: {},
    log: () => {},
    spawnSync,
    env: {},
  });
  assert.equal(calls, 1);
});

test('a render that fails everywhere returns the last failure rather than throwing', async () => {
  const result = await renderWithBrowserFallback({
    args: ['remotion', 'render'],
    spawnOptions: {},
    log: () => {},
    spawnSync: () => ({ status: 4 }),
    env: {},
  });
  assert.equal(result.status, 4);
});

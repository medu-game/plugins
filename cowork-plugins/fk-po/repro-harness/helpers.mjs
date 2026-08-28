// The ONLY module agent-written repro scenarios may import. Wraps Playwright
// so every user-visible action also lands in events.jsonl, which render.mjs
// turns into captions, cursor movement and the bug-moment highlight.
//
// Deliberately shares nothing with scripts/sandbox-e2e: this harness targets
// the acceptance environment from Cowork, needs no docker and no dev-stack lock.
import { chromium } from 'playwright';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEventLog } from './events.mjs';

const DEFAULT_BASE_URL = 'https://app-acc.flowkeeper.nl';
// Full HD; must equal the Remotion composition size (remotion/constants.ts)
// so click coordinates map 1:1 onto video pixels.
export const VIEWPORT = { width: 1920, height: 1080 };
// How long a control gets to react to the pointer arriving before its position
// is taken as final. Measured on the dashboard's new-task button: it reveals a
// label on hover and its disc shifts 49px left doing so, so a coordinate read
// before the pointer arrived described a button that is no longer there.
const HOVER_SETTLE_MS = 400;

function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// Both accounts live on the same host, so only the credentials are per-account.
// Deliberately no fallback between them: a help video recorded as the bug-video
// account would fill with bugvideo- residue and render its captions in the wrong
// language, and that is far worse than a run that stops and says which key is
// missing.
// `baseURL` falls back to the shared FK_ACC_BASE_URL, because for a long time
// there was only one host. It stopped being safe to assume: a developer points
// FK_ACC_BASE_URL at the local dev stack, and a help run would then have sent
// acceptance credentials to localhost. An account may name its own host.
const ACCOUNTS = {
  acc: {
    email: 'FK_ACC_EMAIL',
    password: 'FK_ACC_PASSWORD',
    baseURL: 'FK_ACC_BASE_URL',
  },
  help: {
    email: 'FK_HELP_EMAIL',
    password: 'FK_HELP_PASSWORD',
    baseURL: 'FK_HELP_BASE_URL',
  },
};

function appEnvPath(env) {
  const candidates = [
    env.FK_PO_APP_CONFIG,
    ...globSync('/sessions/*/mnt/FlowKeeper/.fk-po/app.env'),
    env.HOME ? join(env.HOME, 'FlowKeeper/.fk-po/app.env') : null,
    '/workspace/.fk-po/app.env',
  ].filter(Boolean);
  return candidates.find((c) => existsSync(c)) ?? null;
}

/**
 * Merge app.env into the environment, without overriding what the shell set.
 *
 * resolveConfig reads that file too, but only ever returns the four fields it
 * knows about, so anything else in there reaches nobody. A storyboard reads its
 * own keys straight off process.env at import time, and those were silently
 * ignored: the run then matched the default names, waited 30 seconds for a
 * person who is not on screen, and failed as if the selector were wrong.
 */
export function loadAppEnv(env = process.env) {
  const path = appEnvPath(env);
  if (!path) return {};
  const values = parseEnvFile(path);
  for (const [key, value] of Object.entries(values)) {
    if (env[key] === undefined) env[key] = value;
  }
  return values;
}

export function resolveConfig(env = process.env, { account = 'acc' } = {}) {
  const keys = ACCOUNTS[account];
  if (!keys) {
    throw new Error(
      `Unknown account "${account}"; expected one of ${Object.keys(ACCOUNTS).join(', ')}.`,
    );
  }
  let fromFile = {};
  if (!env[keys.email] || !env[keys.password]) {
    const found = appEnvPath(env);
    if (found) fromFile = parseEnvFile(found);
  }
  const pick = (key) => env[key] || fromFile[key] || null;
  return {
    account,
    baseURL:
      pick(keys.baseURL) ?? pick('FK_ACC_BASE_URL') ?? DEFAULT_BASE_URL,
    email: pick(keys.email),
    password: pick(keys.password),
  };
}

export async function startRun({ name, account = 'acc' }) {
  const config = resolveConfig(process.env, { account });
  const recordDir = process.env.REPRO_RECORD_DIR || null;
  // Opt-in local-stack support. Against acceptance neither is set and the
  // launch is unchanged; against the dev stack the hostnames only resolve via
  // the proxy container and the cert is self-signed.
  const resolverRules = process.env.FK_HOST_RESOLVER_RULES || null;
  const insecureTls = process.env.FK_INSECURE_TLS === '1';
  const browser = await chromium.launch({
    headless: true,
    args: [
      ...(resolverRules ? [`--host-resolver-rules=${resolverRules}`] : []),
      ...(insecureTls ? ['--ignore-certificate-errors', '--no-sandbox'] : []),
    ],
  });
  const context = await browser.newContext({
    baseURL: config.baseURL,
    viewport: VIEWPORT,
    ...(insecureTls ? { ignoreHTTPSErrors: true } : {}),
    ...(recordDir ? { recordVideo: { dir: recordDir, size: VIEWPORT } } : {}),
  });
  const eventsFile =
    process.env.REPRO_EVENTS_FILE ||
    join(recordDir || process.cwd(), 'events.jsonl');
  const events = createEventLog(eventsFile);
  const page = await context.newPage();
  events.log('start', { name });

  const run = {
    step(label) {
      events.log('step', { label });
    },
    /**
     * @param {{ company?: string }} [options] name of the company to enter when
     *   the account belongs to more than one. Required in that case: which
     *   company you land in decides what is on screen, so there is no safe
     *   default to pick.
     */
    async login(options = {}) {
      if (!config.email || !config.password) {
        throw new Error(
          `No credentials for the "${config.account}" account. Add ${ACCOUNTS[config.account].email} and ${ACCOUNTS[config.account].password} to ~/FlowKeeper/.fk-po/app.env (see melissa-setup.md).`,
        );
      }
      run.step('Log in as the test account');
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      // Same two-step flow as the dev harness. The submit label is localized
      // (FK-538), so match by type, not by text.
      const submit = page.locator('form button[type="submit"]');
      await page.locator('input[name="email"]').fill(config.email);
      await submit.click();
      await page
        .locator('input[name="password"]')
        .waitFor({ state: 'visible', timeout: 10_000 });
      await page.locator('input[name="password"]').fill(config.password);
      // An account in more than one company lands on the picker instead of the
      // dashboard, so wait for either. Waiting only for /dashboard times out
      // there with no hint of why, which cost a full recording on the preview
      // environment: its seeder puts every demo member in two companies.
      await Promise.all([
        page.waitForURL(/\/(dashboard|select-company)/, { timeout: 20_000 }),
        submit.click(),
      ]);

      if (!new URL(page.url()).pathname.startsWith('/select-company')) return;

      // The picker renders a spinner until the company list resolves, so the
      // cards are not in the DOM at the moment the URL changes. Reading them
      // straight away reports an empty list and blames the caller's company
      // name for it.
      const cards = page.locator('[data-testid="company-card"]');
      await cards.first().waitFor({ state: 'visible', timeout: 20_000 });

      if (!options.company) {
        const names = await page
          .locator('[data-testid="company-card-name"]')
          .allInnerTexts();
        throw new Error(
          `This account belongs to several companies, so login stopped at the picker. Pass one to run.login({ company }): ${names.join(', ')}.`,
        );
      }

      const card = cards.filter({ hasText: options.company });
      if ((await card.count()) === 0) {
        const names = await page
          .locator('[data-testid="company-card-name"]')
          .allInnerTexts();
        throw new Error(
          `No company named "${options.company}" on the picker. Available: ${names.join(', ')}.`,
        );
      }

      run.step(`Enter ${options.company}`);
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 20_000 }),
        card.first().locator('[data-testid="company-card-join"]').click(),
      ]);
    },
    async click(selector, label) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 10_000 });

      // Hover first, then measure. A control that expands or shifts under the
      // pointer sits in one place before it arrives and another after, and the
      // recording shows the second while a coordinate read beforehand
      // describes the first: the drawn cursor then lands beside the button it
      // is supposed to be pressing.
      const approach = await locator.boundingBox();
      if (approach) {
        await page.mouse.move(
          Math.round(approach.x + approach.width / 2),
          Math.round(approach.y + approach.height / 2),
        );
        await page.waitForTimeout(HOVER_SETTLE_MS);
      }

      const box = await locator.boundingBox();
      if (!box) {
        await locator.click();
        return;
      }
      const x = Math.round(box.x + box.width / 2);
      const y = Math.round(box.y + box.height / 2);
      await page.mouse.move(x, y);
      events.log('click', { x, y, label });
      // Click the point we logged, not the element: those are the same thing
      // only as long as nothing moves, and something moved.
      await page.mouse.click(x, y);
    },
    async fill(selector, value, label) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 10_000 });
      // Never log the value: form input may be sensitive.
      events.log('fill', { label });
      await locator.fill(value);
    },
    markBug(label) {
      events.log('bug', { label });
    },
    async screenshot(fileName) {
      if (recordDir) {
        await page.screenshot({ path: join(recordDir, fileName) });
      }
    },
    async finish() {
      events.finish();
      await context.close(); // flushes the webm
      await browser.close();
    },
  };

  return { page, run, config };
}

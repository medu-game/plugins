import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAppEnv, resolveConfig, startRun } from './helpers.mjs';
import { parseEvents } from './events.mjs';

test('resolveConfig prefers process env and defaults the base URL', () => {
  const cfg = resolveConfig({ FK_ACC_EMAIL: 'a@b.nl', FK_ACC_PASSWORD: 'x' });
  assert.equal(cfg.baseURL, 'https://app-acc.flowkeeper.nl');
  assert.equal(cfg.email, 'a@b.nl');
});

test('resolveConfig reads an app.env file when env vars are absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  const file = join(dir, 'app.env');
  writeFileSync(
    file,
    'FK_ACC_BASE_URL=https://example.test\nFK_ACC_EMAIL=e@f.nl\nFK_ACC_PASSWORD=s3cret\n',
  );
  const cfg = resolveConfig({ FK_PO_APP_CONFIG: file });
  assert.equal(cfg.baseURL, 'https://example.test');
  assert.equal(cfg.password, 's3cret');
});

test('instrumented run records events and a webm for a file:// page', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rec-'));
  process.env.REPRO_RECORD_DIR = dir;
  delete process.env.REPRO_EVENTS_FILE;
  const html = join(dir, 'page.html');
  writeFileSync(
    html,
    '<button id="go" onclick="this.textContent=\'stuk\'">Klik</button>',
  );
  const { page, run } = await startRun({ name: 'unit' });
  await page.goto(pathToFileURL(html).href);
  run.step('Open testpagina');
  await run.click('#go', 'Klik op de knop');
  run.markBug('Knop toont stuk');
  await run.screenshot('bug-state.png');
  await run.finish();
  const events = parseEvents(readFileSync(join(dir, 'events.jsonl'), 'utf8'));
  assert.deepEqual(
    events.map((e) => e.kind),
    ['start', 'step', 'click', 'bug', 'end'],
  );
  const click = events.find((e) => e.kind === 'click');
  assert.ok(click.x > 0 && click.y > 0, 'click has page coordinates');
  const files = readdirSync(dir);
  assert.ok(files.some((f) => f.endsWith('.webm')), 'webm recorded');
  assert.ok(files.includes('bug-state.png'), 'screenshot written');
});

test('resolveConfig reads the help account from process env', () => {
  const cfg = resolveConfig(
    { FK_HELP_EMAIL: 'help@example.test', FK_HELP_PASSWORD: 'x' },
    { account: 'help' },
  );
  assert.equal(cfg.email, 'help@example.test');
  assert.equal(cfg.password, 'x');
  assert.equal(cfg.account, 'help');
  assert.equal(cfg.baseURL, 'https://app-acc.flowkeeper.nl');
});

test('resolveConfig reads the help account from an app.env file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-help-'));
  const file = join(dir, 'app.env');
  writeFileSync(
    file,
    [
      'FK_ACC_EMAIL=acc@example.test',
      'FK_ACC_PASSWORD=acc-secret',
      'FK_HELP_EMAIL=help@example.test',
      'FK_HELP_PASSWORD=help-secret',
    ].join('\n'),
    'utf8',
  );
  const cfg = resolveConfig({ FK_PO_APP_CONFIG: file }, { account: 'help' });
  assert.equal(cfg.email, 'help@example.test');
  assert.equal(cfg.password, 'help-secret');
});

test('the help account never falls back to the acceptance credentials', () => {
  // Points at a file that holds only the acc keys, because otherwise the
  // candidate list reaches the real app.env on the machine running the test and
  // the assertion turns into a statement about the developer's laptop.
  const dir = mkdtempSync(join(tmpdir(), 'cfg-acc-only-'));
  const file = join(dir, 'app.env');
  writeFileSync(file, 'FK_ACC_EMAIL=acc@example.test\nFK_ACC_PASSWORD=acc-secret', 'utf8');
  const cfg = resolveConfig(
    {
      FK_PO_APP_CONFIG: file,
      FK_ACC_EMAIL: 'acc@example.test',
      FK_ACC_PASSWORD: 'acc-secret',
    },
    { account: 'help' },
  );
  assert.equal(cfg.email, null);
  assert.equal(cfg.password, null);
});

test('the default account is unchanged and still reads FK_ACC_*', () => {
  const cfg = resolveConfig({ FK_ACC_EMAIL: 'a@b.nl', FK_ACC_PASSWORD: 'x' });
  assert.equal(cfg.account, 'acc');
  assert.equal(cfg.email, 'a@b.nl');
});


test('an unknown account key throws rather than logging in as someone else', () => {
  assert.throws(() => resolveConfig({}, { account: 'nope' }), /unknown account/i);
});

test('the help account can live on its own host', () => {
  const cfg = resolveConfig(
    {
      FK_ACC_BASE_URL: 'https://app.flowkeeper.dev',
      FK_HELP_BASE_URL: 'https://app-acc.flowkeeper.nl',
      FK_HELP_EMAIL: 'help@example.test',
      FK_HELP_PASSWORD: 'x',
    },
    { account: 'help' },
  );
  assert.equal(cfg.baseURL, 'https://app-acc.flowkeeper.nl');
});

test('without its own host the help account falls back to the shared one', () => {
  const cfg = resolveConfig(
    {
      FK_ACC_BASE_URL: 'https://app.flowkeeper.dev',
      FK_HELP_EMAIL: 'help@example.test',
      FK_HELP_PASSWORD: 'x',
    },
    { account: 'help' },
  );
  assert.equal(cfg.baseURL, 'https://app.flowkeeper.dev');
});

test('a per-account host never leaks into the acceptance account', () => {
  const cfg = resolveConfig({
    FK_HELP_BASE_URL: 'https://app-acc.flowkeeper.nl',
    FK_ACC_BASE_URL: 'https://app.flowkeeper.dev',
    FK_ACC_EMAIL: 'a@b.nl',
    FK_ACC_PASSWORD: 'x',
  });
  assert.equal(cfg.baseURL, 'https://app.flowkeeper.dev');
});

test('loadAppEnv carries non-credential keys into the environment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-load-'));
  const file = join(dir, 'app.env');
  writeFileSync(
    file,
    ['FK_HELP_OWNER_NAME=Sanne de Vries', 'FK_HELP_COLLEAGUE_NAME=Emma Jansen'].join('\n'),
    'utf8',
  );
  const env = { FK_PO_APP_CONFIG: file };
  loadAppEnv(env);
  assert.equal(env.FK_HELP_OWNER_NAME, 'Sanne de Vries');
  assert.equal(env.FK_HELP_COLLEAGUE_NAME, 'Emma Jansen');
});

test('loadAppEnv never overrides a value already set in the shell', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-load2-'));
  const file = join(dir, 'app.env');
  writeFileSync(file, 'FK_HELP_OWNER_NAME=Uit het bestand', 'utf8');
  const env = { FK_PO_APP_CONFIG: file, FK_HELP_OWNER_NAME: 'Uit de shell' };
  loadAppEnv(env);
  assert.equal(env.FK_HELP_OWNER_NAME, 'Uit de shell');
});

test('loadAppEnv is a no-op when there is no config file', () => {
  const env = { FK_PO_APP_CONFIG: join(tmpdir(), 'does-not-exist-app.env') };
  assert.doesNotThrow(() => loadAppEnv(env));
});

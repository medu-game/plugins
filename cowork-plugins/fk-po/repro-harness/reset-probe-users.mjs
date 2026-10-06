// reset-probe-users.mjs: archive the probe users a help-video run left behind.
//
// Usage: node reset-probe-users.mjs --match <text> [--account help] [--company <name>] [--apply]
//
// A probe or recording that invites a user leaves that user behind, and the
// next run then films a list that grows by one every time. Archiving them is
// the reset. Without --apply it only lists what it would archive.
//
// Only users whose email contains --match and who are not archived yet are
// touched, and never the account that runs the reset. Archived users are
// skipped on purpose: archiving is limited to 20 calls a minute, and a script
// that re-archived every old probe address hit that limit with "Too Many
// Attempts" and stopped (2026-10-06). A 429 that still happens is waited out
// using the server's Retry-After.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ARCHIVED_STATUS = 3;
export const OPEN_STATUSES = [1, 2];
const MAX_RETRIES = 5;
const DEFAULT_RETRY_MS = 60_000;

/**
 * @param {Array<{ id: number, email?: string, status?: number }>} users
 * @param {{ match: string, selfEmail?: string | null }} options
 */
export function selectProbeUsers(users, { match, selfEmail = null }) {
  const needle = match.toLowerCase();
  const self = selfEmail?.toLowerCase() ?? null;
  return users.filter((user) => {
    const email = user.email?.toLowerCase() ?? '';
    return email.includes(needle) && email !== self && user.status !== ARCHIVED_STATUS;
  });
}

/**
 * Retry-After is either a number of seconds or an HTTP date.
 *
 * @param {string | null | undefined} header
 * @param {number} [now]
 */
export function retryAfterMs(header, now = Date.now()) {
  if (header == null || header === '') return DEFAULT_RETRY_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? DEFAULT_RETRY_MS : Math.max(0, at - now);
}

/**
 * @param {() => Promise<{ status: number, retryAfter?: string | null }>} archiveOnce
 * @param {{ sleep: (ms: number) => Promise<void>, maxRetries?: number }} options
 * @returns {Promise<number>} the final HTTP status
 */
export async function archiveWithRetry(archiveOnce, { sleep, maxRetries = MAX_RETRIES }) {
  for (let attempt = 0; ; attempt++) {
    const { status, retryAfter } = await archiveOnce();
    if (status !== 429 || attempt >= maxRetries) return status;
    await sleep(retryAfterMs(retryAfter));
  }
}

/**
 * @param {{
 *   listUsers: (status: number) => Promise<Array<{ id: number, email?: string, status?: number }>>,
 *   archive: (userId: number) => Promise<{ status: number, retryAfter?: string | null }>,
 *   match: string,
 *   selfEmail?: string | null,
 *   apply?: boolean,
 *   log?: (line: string) => void,
 *   sleep?: (ms: number) => Promise<void>,
 * }} options
 */
export async function resetProbeUsers({
  listUsers,
  archive,
  match,
  selfEmail = null,
  apply = false,
  log = console.log,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!match || match.trim().length < 3) {
    throw new Error('Pass --match with at least 3 characters, so the reset can never select real users.');
  }

  const users = [];
  for (const status of OPEN_STATUSES) {
    for (const user of await listUsers(status)) users.push({ ...user, status: user.status ?? status });
  }
  const targets = selectProbeUsers(users, { match, selfEmail });

  const summary = { found: targets.length, archived: [], failed: [] };
  if (!apply) {
    for (const user of targets) log(`[reset] would archive ${user.email}`);
    log(`[reset] ${targets.length} probe user(s) found; run again with --apply to archive them`);
    return summary;
  }

  for (const user of targets) {
    const status = await archiveWithRetry(() => archive(user.id), { sleep });
    if (status >= 200 && status < 300) {
      summary.archived.push(user.email);
      log(`[reset] archived ${user.email}`);
    } else {
      summary.failed.push({ email: user.email, status });
      log(`[reset] could not archive ${user.email}: HTTP ${status}`);
    }
  }
  log(`[reset] archived ${summary.archived.length} of ${targets.length}`);
  return summary;
}

function argValue(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? null : (argv[at + 1] ?? null);
}

async function main(argv) {
  const match = argValue(argv, '--match');
  const account = argValue(argv, '--account') ?? 'help';
  const company = argValue(argv, '--company') ?? undefined;
  const apply = argv.includes('--apply');

  // The reset is not a recording: keep its steps out of the run's events.jsonl.
  process.env.REPRO_EVENTS_FILE = join(mkdtempSync(join(tmpdir(), 'fk-reset-')), 'events.jsonl');
  const { loadAppEnv, startRun } = await import('./helpers.mjs');
  loadAppEnv();
  const { page, run, config } = await startRun({ name: 'reset-probe-users', account });

  try {
    const apiCalls = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/')) apiCalls.push(request.url());
    });
    await run.login({ company });
    await page.waitForLoadState('networkidle');
    if (apiCalls.length === 0) throw new Error('The app made no API call after login, so the API host is unknown.');
    const apiBase = apiCalls[0].slice(0, apiCalls[0].indexOf('/api/v1/') + '/api/v1'.length);

    const xsrf = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value;
    const companyId = await page.evaluate(() => localStorage.getItem('companyId'));
    const headers = {
      Accept: 'application/json',
      ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
      ...(companyId ? { 'Company-Id': companyId } : {}),
    };

    const listUsers = async (status) => {
      const users = [];
      for (let pageNo = 1; ; pageNo++) {
        const response = await page.request.get(
          `${apiBase}/users?company_status=${status}&per_page=100&page=${pageNo}`,
          { headers },
        );
        if (!response.ok()) throw new Error(`Listing users answered HTTP ${response.status()}`);
        const body = await response.json();
        users.push(...(body.data ?? []));
        if (!body.meta || pageNo >= body.meta.last_page) return users;
      }
    };
    const archive = async (userId) => {
      const response = await page.request.post(`${apiBase}/users/${userId}/archive`, { headers, data: {} });
      return { status: response.status(), retryAfter: response.headers()['retry-after'] ?? null };
    };

    const summary = await resetProbeUsers({ listUsers, archive, match, selfEmail: config.email, apply });
    if (summary.failed.length > 0) process.exitCode = 1;
  } finally {
    await run.finish();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[reset] ${error.message}`);
    process.exit(1);
  });
}

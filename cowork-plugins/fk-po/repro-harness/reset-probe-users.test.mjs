import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVED_STATUS,
  archiveWithRetry,
  resetProbeUsers,
  retryAfterMs,
  selectProbeUsers,
} from './reset-probe-users.mjs';

const USERS = [
  { id: 1, email: 'you@flowkeeper.nl', status: 2 },
  { id: 2, email: 'proef-anna@example.com', status: 1 },
  { id: 3, email: 'PROEF-bert@example.com', status: 2 },
  { id: 4, email: 'proef-carla@example.com', status: ARCHIVED_STATUS },
  { id: 5, email: 'sophie.devries@demo.flowkeeper.dev', status: 2 },
];

test('selects open users whose email matches, case-insensitively', () => {
  const ids = selectProbeUsers(USERS, { match: 'proef-' }).map((u) => u.id);
  assert.deepEqual(ids, [2, 3]);
});

test('never selects an archived user, so the archive limit is not spent on them', () => {
  const ids = selectProbeUsers(USERS, { match: 'carla' }).map((u) => u.id);
  assert.deepEqual(ids, []);
});

test('never selects the account that runs the reset', () => {
  const ids = selectProbeUsers(USERS, { match: 'proef-', selfEmail: 'PROEF-ANNA@example.com' }).map((u) => u.id);
  assert.deepEqual(ids, [3]);
});

test('Retry-After is read as seconds or as an HTTP date', () => {
  assert.equal(retryAfterMs('12'), 12_000);
  assert.equal(retryAfterMs('Tue, 06 Oct 2026 14:00:30 GMT', Date.parse('Tue, 06 Oct 2026 14:00:00 GMT')), 30_000);
  assert.equal(retryAfterMs(null), 60_000);
  assert.equal(retryAfterMs('soon'), 60_000);
});

test('a 429 is waited out and the same call retried', async () => {
  const answers = [{ status: 429, retryAfter: '7' }, { status: 429, retryAfter: '3' }, { status: 200 }];
  const slept = [];
  const status = await archiveWithRetry(async () => answers.shift(), {
    sleep: async (ms) => slept.push(ms),
  });
  assert.equal(status, 200);
  assert.deepEqual(slept, [7_000, 3_000]);
});

test('retrying stops after the limit and reports the 429', async () => {
  let calls = 0;
  const status = await archiveWithRetry(
    async () => {
      calls++;
      return { status: 429, retryAfter: '1' };
    },
    { sleep: async () => {}, maxRetries: 2 },
  );
  assert.equal(status, 429);
  assert.equal(calls, 3);
});

function fakeApi(users) {
  const archived = [];
  return {
    archived,
    listUsers: async (status) => users.filter((u) => u.status === status),
    archive: async (id) => {
      archived.push(id);
      return { status: 200 };
    },
  };
}

test('without --apply nothing is archived, only listed', async () => {
  const api = fakeApi(USERS);
  const lines = [];
  const summary = await resetProbeUsers({ ...api, match: 'proef-', log: (l) => lines.push(l) });
  assert.equal(summary.found, 2);
  assert.deepEqual(api.archived, []);
  assert.ok(lines.some((l) => l.includes('would archive proef-anna@example.com')));
});

test('with --apply only the open probe users are archived', async () => {
  const api = fakeApi(USERS);
  const summary = await resetProbeUsers({ ...api, match: 'proef-', apply: true, log: () => {} });
  assert.deepEqual(api.archived, [2, 3]);
  assert.deepEqual(summary.archived, ['proef-anna@example.com', 'PROEF-bert@example.com']);
  assert.deepEqual(summary.failed, []);
});

test('a refused archive is reported, the rest still go ahead', async () => {
  const api = fakeApi(USERS);
  api.archive = async (id) => ({ status: id === 2 ? 422 : 200 });
  const summary = await resetProbeUsers({ ...api, match: 'proef-', apply: true, log: () => {} });
  assert.deepEqual(summary.failed, [{ email: 'proef-anna@example.com', status: 422 }]);
  assert.deepEqual(summary.archived, ['PROEF-bert@example.com']);
});

test('a missing or too short --match is refused before any call', async () => {
  const api = fakeApi(USERS);
  await assert.rejects(resetProbeUsers({ ...api, match: '' }), /--match/);
  await assert.rejects(resetProbeUsers({ ...api, match: 'pr' }), /--match/);
});

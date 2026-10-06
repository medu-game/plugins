// Where the PO's own files live: credentials, finished videos, work dirs,
// storyboards and the voice cache. Outside every repository on purpose.
import { existsSync, globSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function resolveFkPoDir(env = process.env) {
  const candidates = [
    ...globSync('/sessions/*/mnt/FlowKeeper/.fk-po'),
    ...(env.HOME ? [join(env.HOME, 'FlowKeeper/.fk-po')] : []),
    '/workspace/.fk-po',
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** The next unused `<prefix>-N` under base, created. */
export function nextRunDir(base, prefix) {
  mkdirSync(base, { recursive: true });
  const taken = readdirSync(base)
    .map((name) => name.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1])
    .filter(Boolean)
    .map(Number);
  const dir = join(base, `${prefix}-${Math.max(0, ...taken) + 1}`);
  mkdirSync(dir);
  return dir;
}

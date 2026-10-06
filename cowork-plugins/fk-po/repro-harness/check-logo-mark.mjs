#!/usr/bin/env node
// Proves that remotion/LogoMark.tsx reproduces the shipped Flowkeeper logo, by
// comparing it pixel by pixel against the app's own asset rather than by eye.
//
// The reference is frontend-application/public/logo.svg, which is not really a
// vector: it wraps a 525x525 PNG as base64. That PNG is the logo the product
// shows, so it is the only authority worth checking against. The design system
// project carries logo SVGs too, but they are hand rebuilds that disagree with
// each other and with the app, so they are NOT usable here.
//
// Anti-aliased pixels are left out of the count on purpose. Two rasterisers
// never agree on an edge ramp, so the question this answers is "is every
// unambiguous pixel on the right shape", not "are the two files identical".
//
// Usage: node check-logo-mark.mjs [path/to/logo.svg]

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const D = 525;
const MAX_MISMATCH = 60; // the fitted geometry sits at 26

const CANDIDATES = [
  process.argv[2],
  join(here, '../../../..', 'frontend-application/public/logo.svg'),
  join(process.cwd(), 'frontend-application/public/logo.svg'),
  '/workspace/frontend-application/public/logo.svg',
].filter(Boolean);

const source = CANDIDATES.find((p) => existsSync(p));
if (!source) {
  console.error('No reference logo found. Looked in:');
  for (const c of CANDIDATES) console.error('  ' + c);
  console.error('\nPass the path to frontend-application/public/logo.svg as an argument.');
  process.exit(2);
}

const ffmpeg = await (async () => {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) return 'ffmpeg';
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
})();

/** Read the MARK numbers out of the component, so this file keeps no second copy. */
function readMark() {
  const src = readFileSync(join(here, 'remotion/LogoMark.tsx'), 'utf8');
  const body = src.split('export const MARK = {')[1]?.split('} as const;')[0];
  if (!body) throw new Error('LogoMark.tsx no longer declares MARK the way this check reads it');
  const m = {};
  for (const [, key, value] of body.matchAll(/^\s*(\w+):\s*([\d.]+),/gm)) m[key] = Number(value);
  const need = ['cx', 'cy', 'r', 'S', 'dy', 'left', 'bar1X', 'bar2X', 'bar3X', 'apexX', 'armX'];
  const missing = need.filter((k) => !(k in m));
  if (missing.length) throw new Error('MARK is missing ' + missing.join(', '));
  return m;
}

const work = mkdtempSync(join(tmpdir(), 'fk-logo-'));
try {
  const svg = readFileSync(source, 'utf8');
  const b64 = svg.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
  if (!b64) throw new Error(`${source} carries no embedded PNG, so it is not the asset this checks`);
  const png = join(work, 'ref.png');
  writeFileSync(png, Buffer.from(b64, 'base64'));

  const raw = join(work, 'ref.raw');
  const conv = spawnSync(ffmpeg, ['-y', '-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgba', raw]);
  if (conv.status !== 0) throw new Error('ffmpeg could not decode the reference: ' + conv.stderr);
  const ref = readFileSync(raw);
  if (ref.length !== D * D * 4) throw new Error(`expected a ${D}x${D} reference, got ${ref.length / 4} pixels`);

  const m = readMark();
  const rows = [m.cy - m.dy, m.cy, m.cy + m.dy];
  const shapes = {
    green: [
      [m.left, rows[0], m.bar1X, rows[0]],
      [m.left, rows[1], m.bar2X, rows[1]],
      [m.left, rows[2], m.bar3X, rows[2]],
    ],
    white: [
      [m.armX, rows[0], m.apexX, rows[1]],
      [m.apexX, rows[1], m.armX, rows[2]],
    ],
  };

  const distToSegment = (px, py, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const len = vx * vx + vy * vy;
    const t = Math.min(1, Math.max(0, len ? (wx * vx + wy * vy) / len : 0));
    return Math.hypot(wx - t * vx, wy - t * vy);
  };

  let mismatched = 0;
  let tested = 0;
  const byClass = {};
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      const i = (y * D + x) * 4;
      const [r, g, b, a] = [ref[i], ref[i + 1], ref[i + 2], ref[i + 3]];
      let want = -1;
      if (a === 0) want = 0;
      else if (a === 255) {
        if (r < 70 && g < 20 && b > 200) want = 1;
        else if (r < 30 && g > 200 && b > 100 && b < 180) want = 2;
        else if (r > 250 && g > 250 && b > 250) want = 3;
      }
      if (want < 0) continue; // anti-aliased, no opinion

      const px = x + 0.5, py = y + 0.5;
      const fromCentre = Math.hypot(px - m.cx, py - m.cy);
      if (Math.abs(fromCentre - m.r) < 2.5) continue; // the rim's own ramp

      let got = fromCentre <= m.r ? 1 : 0;
      if (got === 1) {
        for (const s of shapes.green) if (distToSegment(px, py, ...s) <= m.S / 2) { got = 2; break; }
        for (const s of shapes.white) if (distToSegment(px, py, ...s) <= m.S / 2) { got = 3; break; }
      }
      tested++;
      if (got !== want) {
        mismatched++;
        const k = `${want}->${got}`;
        byClass[k] = (byClass[k] || 0) + 1;
      }
    }
  }

  const pct = (100 * mismatched / tested).toFixed(4);
  console.log(`reference   ${source}`);
  console.log(`compared    ${tested} unambiguous pixels`);
  console.log(`on the wrong shape  ${mismatched}  (${pct}%)`);
  if (mismatched) console.log(`            ${JSON.stringify(byClass)}  (0 outside, 1 disc, 2 bar, 3 chevron)`);

  if (mismatched > MAX_MISMATCH) {
    console.error(`\nFAIL: more than ${MAX_MISMATCH} pixels sit on the wrong shape.`);
    process.exit(1);
  }
  console.log('\nOK');
} finally {
  rmSync(work, { recursive: true, force: true });
}

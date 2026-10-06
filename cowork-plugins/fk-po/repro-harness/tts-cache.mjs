// A take that was already paid for is never bought twice. Keyed on everything
// the request sends, so a different voice, model or stability is a new take.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export function ttsCacheKey(text, { voiceId, modelId, stability }) {
  return createHash('sha256')
    .update(JSON.stringify({ text, voiceId, modelId, stability }))
    .digest('hex')
    .slice(0, 32);
}

/**
 * @param synth (text, outPath, opts) => Promise<alignment | null>
 * @returns {Promise<{ alignment: object | null, cached: boolean }>}
 */
export async function cachedSynthesize(text, outPath, opts, { cacheDir, synth, fresh = false }) {
  if (!cacheDir) return { alignment: await synth(text, outPath, opts), cached: false };

  const key = ttsCacheKey(text, opts);
  const audio = join(cacheDir, `${key}.mp3`);
  const meta = join(cacheDir, `${key}.json`);
  if (!fresh && existsSync(audio) && existsSync(meta)) {
    copyFileSync(audio, outPath);
    return { alignment: JSON.parse(readFileSync(meta, 'utf8')).alignment, cached: true };
  }

  const alignment = await synth(text, outPath, opts);
  mkdirSync(cacheDir, { recursive: true });
  copyFileSync(outPath, audio);
  writeFileSync(meta, JSON.stringify({ alignment }), 'utf8');
  return { alignment, cached: false };
}

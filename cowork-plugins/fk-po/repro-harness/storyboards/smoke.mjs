// Self-contained storyboard that exercises the whole help-video chain without
// the app, credentials or a network: narration -> dwell -> capture -> render
// with audio -> WebVTT. This is the gate the bug pipeline's spike-check does
// not cover, because ReproVideo never had an audio track.
//
// Run:
//   node narrate.mjs storyboards/smoke.mjs --work /tmp/smoke
//   FK_STORYBOARD=storyboards/smoke.mjs node record-repro.mjs play-storyboard.mjs --work /tmp/smoke
//   node render-help.mjs --work /tmp/smoke --title "Smoke" --out ./out

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const meta = {
  slug: 'smoke',
  title: 'Smoke test',
  subtitle: 'Pijplijncontrole, geen echte help-video',
};

const PAGE_HTML = `<!doctype html>
<meta charset="utf-8">
<style>
  body { font: 400 28px Helvetica, Arial, sans-serif; margin: 0; background: #F9FAFB; color: #111827; }
  header { padding: 48px 64px 24px; font-size: 44px; font-weight: 700; }
  main { padding: 0 64px; display: flex; gap: 32px; align-items: flex-start; }
  button { font-size: 28px; padding: 20px 36px; border-radius: 12px; border: 0;
           background: #3B82F6; color: white; cursor: pointer; }
  #panel { margin-top: 8px; padding: 28px 36px; border-radius: 12px;
           background: white; border: 2px solid #E5E7EB; min-width: 520px; }
</style>
<header>Voorbeeldscherm</header>
<main>
  <button id="primary" onclick="document.getElementById('panel').textContent='Klaar'">Actie uitvoeren</button>
  <div id="panel">Nog niets gedaan</div>
</main>`;

export async function setup({ page, workDir }) {
  const file = join(workDir, 'smoke-page.html');
  writeFileSync(file, PAGE_HTML, 'utf8');
  await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded' });
}

export const beats = [
  {
    id: 'intro',
    narration: 'Dit is een voorbeeldscherm waarop we een actie uitvoeren.',
  },
  {
    id: 'klik',
    narration: 'Klik op de blauwe knop om de actie te starten.',
    action: ({ run }) => run.click('#primary', 'Actie uitvoeren'),
    focus: '#primary',
  },
  {
    id: 'resultaat',
    narration: 'Het paneel ernaast laat nu zien dat de actie klaar is.',
    focus: '#panel',
  },
];

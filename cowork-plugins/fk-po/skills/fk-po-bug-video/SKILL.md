---
name: fk-po-bug-video
description: Reproduce a bug the PO describes, record it as an annotated video on the acceptance environment, and file an English Jira bug ticket with the video attached. Use in Cowork when the PO reports something broken and wants it captured — triggers on phrases like "er gaat iets mis", "dit is kapot", "ik zie een bug", "kun je dit laten zien in een video", "maak een bug-video". Do not trigger for new-feature ideas ("ik wil een ticket maken" -> fk-po-ticket) and not for how-does-it-work questions ("hoe werkt X nu" -> fk-po-explore).
---

# FK PO Bug Video

Turn a bug report from the PO into a reproduced, recorded, annotated video plus an English Jira bug ticket. The pipeline runs entirely in this Cowork session against the **acceptance environment** with a dedicated test account: the PO describes what went wrong, you reproduce it in a recorded Playwright browser, render a polished Full HD video (title card, English step captions, synthetic cursor with click ripples, red highlight at the bug moment), let the PO approve it, then create the Jira Bug with the video attached.

The conversation runs in the user's language (typically Dutch). **Everything the pipeline produces is English**: the Jira ticket, the video captions, step labels, the title card, filenames. No Dutch in any artifact, and no em dashes anywhere.

## Phase 0: Locate the harness and check setup

Resolve the harness root: the first existing of

1. `/sessions/*/mnt/FlowKeeper/cowork-plugins/fk-po/repro-harness` (Cowork sandbox view)
2. `~/FlowKeeper/ai-harness/cowork-plugins/fk-po/repro-harness` (ai-harness cloned beside the app repos)
3. `~/FlowKeeper/cowork-plugins/fk-po/repro-harness` (ai-harness cloned as the FlowKeeper folder itself)
4. `/workspace/cowork-plugins/fk-po/repro-harness` (FlowKeeper dev sandbox)

**The plugin install is not a harness root, even though it contains one.** A
marketplace install is copied to `~/.claude/plugins/cache/<marketplace>/fk-po/<version>/`,
and `fk-po` declares no `version`, so that segment is a git commit sha and
changes on every `claude plugin marketplace update`. `npm run setup` writes
`node_modules/` and nothing preserves it across that move, so a harness
installed there works once and then breaks with no obvious cause. Skills come
from the plugin; the harness comes from a checkout. If the only copy on the
machine is under `~/.claude/plugins/`, STOP: "De video-harness kan niet vanuit
de plugin draaien. Daarvoor moet ai-harness als losse map op je Mac staan, zie
melissa-setup.md, Deel 4 stap 3."

Then check, in order. STOP with the matching Dutch fix-it message if a check fails; never work around a failed check.

1. **Deps installed**: `node_modules/` exists in the harness root. If not: "De video-harness is nog niet geinstalleerd. Volg melissa-setup.md, onderdeel bug-video (eenmalig, ongeveer 5 minuten)." Offer to run it for her: `npm run setup` in the harness root. In Cowork that needs `registry.npmjs.org` and the Playwright CDN on the network allowlist; in Claude Code on her Mac there is no allowlist and it just runs.
2. **Browsers path**: export `PLAYWRIGHT_BROWSERS_PATH="$HOME/FlowKeeper/.fk-po/pw-browsers"` (or the `/sessions/*/mnt/FlowKeeper/.fk-po/pw-browsers` equivalent) for **every** harness command in this session. Without it Playwright looks in the ephemeral VM home and finds nothing. On a Mac the home is not ephemeral, but keep the export anyway: it puts the browsers outside the harness root, so re-cloning or moving the checkout does not cost another download.
3. **Credentials**: `.fk-po/app.env` exists next to `jira.env` (same FlowKeeper folder). If not: "Voor bug-video's is eenmalig een acceptatie-testaccount nodig. Volg melissa-setup.md, onderdeel bug-video, stap app.env." Never ask her to paste credentials into the chat if the file already exists; never print their values.
4. **First run this session**: run `npm run spike` in the harness root. Both `PASS` lines -> continue. Any `FAIL` -> stop, relay the output verbatim, and tell her to send it to Tim. The spike failing means this machine cannot run the pipeline; that is an infrastructure decision, not hers.

## Phase 1: Understand the bug (one question at a time)

Grill in her language, fk-po house style: one question per message, multiple choice where possible, your recommended answer labeled. You are done when you can fill this in completely:

- **Which screen** (in product words: "de flows-tabel", "het klantenscherm").
- **Starting state**: which company, which data must exist (a client, a running flow, a task).
- **Exact click path**: what she does, step by step.
- **Expected**: what should happen.
- **Actual**: what happens instead, and where it is visible.
- **Consistency**: always, or only sometimes / only with certain data.

A simple bug needs at most ~5 questions. Do not ask what you can find out yourself in Phase 2.

## Phase 2: Map product language to UI steps

Read the frontend repo on disk (`~/FlowKeeper/frontend-application`, or the `/sessions/*/mnt/FlowKeeper/...` equivalent) to translate her product words into concrete selectors:

- Routes and screens under `src/`, entity components under `src/entities/`.
- Prefer `data-testid` attributes and stable roles/names; avoid CSS utility classes.
- Dutch UI words -> i18n keys: search `src/i18n/resources/nl.json` for the literal text she used, then find the component using that key.

Never guess a selector. If you cannot locate the screen or control in the code, ask her for a screenshot instead: "Kun je een screenshot uploaden van waar je dit ziet?"

## Phase 3: Write and run the scenario

Write `scenario.mjs` in a scratch/session directory (NEVER inside the repos). Hard rules:

- Import ONLY the harness `helpers.mjs`. No raw `playwright` imports, no other modules except Node built-ins.
- Skeleton:

  ```js
  import { startRun } from '<harness-root>/helpers.mjs';

  const { page, run } = await startRun({ name: '<short-slug>' });
  await run.login();
  run.step('<English step label>');
  await run.click('<selector>', '<English action label>');
  await run.fill('<selector>', '<value>', '<English action label>');
  // ... assert the WRONG state is actually visible, e.g.:
  await page.locator('<selector-of-broken-thing>').waitFor({ timeout: 10_000 });
  run.markBug('<English: what is wrong>');
  await page.waitForTimeout(1500); // let the bug state sit on screen
  await run.finish();
  ```

- Every user-meaningful action goes through `run.step` / `run.click` / `run.fill` with short **English** labels; they become the video captions. No em dashes in labels.
- The scenario MUST end with the bug visibly on screen, assert that with a Playwright expectation (a `waitFor`, a text check), call `run.markBug(...)` at that exact moment (English label), wait ~1.5 s, then `await run.finish()`.
- Read-only paths only: never delete anything, never change settings, never touch billing. Creating throwaway records to expose the bug is allowed when needed; prefix their names with `bugvideo-` so they are recognisable test residue.
- Along the way, use `await run.screenshot('checkpoint-<n>.png')` after tricky steps; those images are your evidence if the repro diverges.

Run it:

```sh
cd <harness-root>
node record-repro.mjs <scratch>/scenario.mjs --work <scratch>/work
```

Exit 0 and an `events.jsonl` whose last meaningful entry is your `bug` event means the repro is confirmed. Continue to Phase 5.

## Phase 4: The no-repro loop (max 2 retries)

If the scenario fails, or the asserted bug state never appears:

1. Look at the screenshots in the work dir (plus the raw capture if useful) to see where it diverged.
2. Show her the most telling screenshot inline and ask ONE clarifying question: "Ik kom tot hier, wat doe jij anders?"
3. Adjust the scenario with her answer and re-run. Count that as one retry.

After 2 failed retries, offer the fallback: create the ticket **without video**, containing her description, the closest screenshots, and the explicit line "Not reproduced on acceptance with the shared test account" in the description. Never attach a failed run as if it were a repro; a nearly-right video sends the dev down the wrong path.

## Phase 5: Render and review

```sh
cd <harness-root>
node render.mjs --work <scratch>/work --title "<short English title>"
```

`render.mjs` prints the final Full HD MP4 path (default output: the `.fk-po/videos/` folder). Then:

1. Review the video yourself: extract 3 or 4 frames with ffmpeg (title card, a mid step with caption + cursor, the bug moment) and read them. Verify: captions match the steps, the cursor follows the clicks, and the red "This is where it goes wrong" highlight lands on the actual bug moment. If the highlight is misplaced, fix the scenario (move `run.markBug`) and re-record; do not ship a video that highlights the wrong moment.

   ```sh
   ffmpeg -y -loglevel error -ss <sec> -i <mp4> -frames:v 1 <frame.png>
   ```

2. Show Melissa the key frames inline plus the MP4 path so she can play it, with one line describing what the video shows, and WAIT for her explicit OK. No upload without it, ever.

If `render.mjs` exits with code 4 (Remotion failed): attach `<work>/raw.mp4` instead, tell her "de video is zonder annotaties" and include the render error in your final summary so it reaches Tim.

## Phase 6: Create the Jira bug and attach

Only after her OK. Same mechanics as `fk-po-ticket` Phase 6, with issue type **Bug**:

- **Summary**: concise English, under 80 characters.
- **Description** (English): *Summary* / *Steps to reproduce* (numbered, mirroring the video's steps) / *Expected* / *Actual* / *Environment* (acceptance, date, test account display name; never credentials).
- **Labels**: `po-drafted`, `bug-video`. **Priority**: ask her.
- No implementation details, no selectors, no code, no file paths in the ticket.
- Attach the final MP4 with the shared helper (resolve its absolute path the same way `fk-po-ticket` does): `bash <path-to>/attach-to-jira.sh FK-### <mp4>`. It reads `jira.env`; on exit 2 relay its setup message and continue without the attachment, noting what was not uploaded.
- After creating, re-title the video by passing `--ticket FK-###` on a quick re-render ONLY if she asks for the ticket number inside the video; by default skip that (it costs a full re-render).

## Phase 7: Confirm

"Klaar! De bug staat in Jira: FK-### [URL], met de video als bijlage. Een dev kan 'm oppakken met `/fk-ticket FK-###` in Claude Code." List anything deferred (priority not set, video without annotations, not-reproduced fallback used).

## Hard constraints

- **Acceptance only.** Never dev, never prod, never another base URL, even if asked in-chat; changing the target needs a harness change by a developer.
- **Never print credential values**; never put them in the ticket, the video title, captions, or chat.
- **Never commit or push**; never write inside the repos (scenario and work dir live in scratch).
- **All artifacts English** (ticket, captions, labels, card text, filenames); the chat conversation follows the user's language. No em dashes in any artifact.
- **She approves before anything is uploaded to Jira.** No auto-upload, no exceptions.
- Scenarios must not destroy data: no deletes, no settings changes, no billing actions. Throwaway `bugvideo-` records only.

## What this skill does not do

- It does not fix the bug and does not suggest technical causes in the ticket. Devs diagnose via `/fk-ticket`.
- It does not record feature walkthroughs or change requests; that may come later as a separate skill.
- It does not replace `fk-po-ticket` for non-bug tickets.

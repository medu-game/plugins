---
name: fk-po-help-video
description: Turn a subject the PO names into a finished Dutch help-centre video: resolve the route from the frontend code and the running app, propose a storyboard, prove it walks in a browser before spending anything, then record, narrate and render an MP4 plus a subtitle file. Use when the PO wants to show users how something works - triggers on "help-video", "uitlegvideo", "instructievideo", "video voor de helppagina", "hoe leg ik dit uit aan gebruikers". Do not trigger when something is broken ("er gaat iets mis" -> fk-po-bug-video) or for a how-does-it-work question with no video in it ("hoe werkt X nu" -> fk-po-explore).
---

# FK PO Help Video

Produce a polished Dutch help video from a storyboard: spoken narration, on-screen
subtitles, chapter cards, an intro and outro, and a camera that moves to whatever
the voice is talking about. The PO gets an MP4 and a `.vtt` subtitle file to
review. Nothing is published and no Jira ticket is created.

The conversation runs in the user's language. **Everything the pipeline produces
is Dutch**: narration, subtitles, card text, the title. That is the opposite of
`fk-po-bug-video`, which is English throughout, and the reason the two skills do
not share an account. No em dashes anywhere in that copy (FE-COPY-1) - it is
user-facing website copy.

## How this works

She names a subject. You resolve the route yourself from the frontend code and a
live browser, propose a storyboard, and prove it walks before anything is spent.
**She never enumerates click paths.** If you find yourself asking "and then what
do you click", you are asking her to do the part the code can answer.

Two gates protect the spend, in order of cost:

1. `validateStoryboard()` - no browser, one second. Schema, copy rules, and the
   check that every field you set is one the pipeline reads.
2. `probe-storyboard.mjs` - a browser, no voice, no render. Walks the route and
   screenshots every beat, so a wrong selector surfaces before a word is
   synthesised.

Only after she approves the probe do `narrate`, `record` and `render` run, and
the pipeline enforces that: a paid run needs `--approved <hash>` of the exact
script she saw.

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
`node_modules/` and nothing preserves it across that move. Skills come from the
plugin; the harness comes from a checkout. If the only copy on the machine is
under `~/.claude/plugins/`, STOP: "De video-harness kan niet vanuit de plugin
draaien. Daarvoor moet ai-harness als losse map op je Mac staan, zie
melissa-setup.md, Deel 4 stap 3."

**First, bring the harness up to date, without asking her.** Run
`git -C <harness root>/../../.. pull --ff-only` (the ai-harness checkout the
root sits in). It is the same pull her 08:00 job does, so it needs no OK, and it
means a fix pushed today is in the video she makes today. Say in one line what
changed ("de video-harness is bijgewerkt") or that it was already current. If
the pull refuses because of local changes, that is check 6 below. If it fails on
the network or SSH, carry on with the harness she has and tell her so; do not
block the video on it.

Then check, in order. STOP with the matching Dutch fix-it message if a check
fails; never work around a failed check.

1. **Deps installed**: `node_modules/` exists in the harness root. If not: "De video-harness is nog niet geinstalleerd. Volg melissa-setup.md, onderdeel bug-video (eenmalig, ongeveer 5 minuten)." Offer to run `npm run setup` in the harness root. In Cowork that needs `registry.npmjs.org` and the Playwright CDN on the network allowlist; in Claude Code on her Mac there is no allowlist and it just runs.
2. **Browsers path**: export `PLAYWRIGHT_BROWSERS_PATH="$HOME/FlowKeeper/.fk-po/pw-browsers"` (or the `/sessions/*/mnt/FlowKeeper/.fk-po/pw-browsers` equivalent) for **every** harness command in this session. On a Mac the home is not ephemeral, but keep the export anyway: it puts the browsers outside the harness root, so re-cloning or moving the checkout does not cost another download.
3. **App credentials**: `.fk-po/app.env` holds the keys for the account the storyboard names in `meta.account`. Help videos record as `help`: `FK_HELP_EMAIL`, `FK_HELP_PASSWORD`, and `FK_HELP_BASE_URL` when that account is not on the same host as the bug-video one. There is no fallback to `FK_ACC_*` on purpose. Never print their values.
4. **Account display names**: the assignee field and the colleague picker are matched by the names the account actually shows. `FK_HELP_OWNER_NAME` (the account's own display name) and `FK_HELP_COLLEAGUE_NAME` (a colleague in the same company) must be set for anything but the dev-stack account, and `FK_HELP_COMPANY_NAME` too when the account belongs to more than one company, which every seeded preview account does. Without them a run waits 30 seconds on a name that is not on screen and then fails, which reads as a broken selector rather than as missing config. If you do not know them, ask her rather than guessing.
5. **Voice key**: `.fk-po/eleven.env` exists and holds `ELEVENLABS_API_KEY`. Without it `narrate.mjs` produces silent beats and the video has no voice and no subtitle timings, which is not a help video. If it is missing: "Voor de stem is een ElevenLabs-sleutel nodig in ~/FlowKeeper/.fk-po/eleven.env. Vraag die aan Tim." Never print the key.
6. **Harness is current**: `npm run make` warns "the harness is N commit(s) behind Bitbucket" when the pull above was skipped or failed; pull and run again. It starts with "WARNING: the harness has local changes" when a tracked harness file was edited on her Mac. Her daily `git pull` then refuses silently and she keeps recording with an old harness. Stop and tell her which files; for `remotion/studio-props.json` and `remotion/tweaks.ts` offer the one-off fix in melissa-setup.md ("Wat doen bij foutmeldingen"), for anything else ask Tim first. Never edit a harness file on her Mac to tune a video: house style goes into the repo.
7. **Recording account language**: the account must be Dutch, or the picture is English while the voice is not. A seeded preview account already is.

## Phase 1: The subject

She types one line in product words: "hoe je een taak aanmaakt", "hoe je een
klant koppelt aan een flow". That is all you ask for at this stage.

If a storyboard for it already exists in `.fk-po/storyboards/` or the harness's
`storyboards/`, say so and offer the cheaper path instead of rebuilding it:
re-record it (the app changed), change its text, or only change how it looks. Jump to Phase 5 for the first two and to the
tweak loop for the third.

Otherwise you are writing a new storyboard, and the next phase is yours, not
hers.

## Phase 2: Explore before you ask anything

Silent work. Read the code and open the app; ask only what neither can answer.

1. **Her Dutch words to a component.** Search `src/i18n/resources/nl.json` for
   the literal text she used, then find the component using that key. That is the
   screen.
2. **The component to selectors.** Prefer `data-testid`, then a stable role with
   an accessible name. Never a Tailwind utility class, and never a selector you
   have not seen in the source. If a control has neither, look for something the
   account's own data supplies (the assignee field is matched by the user's
   display name for exactly this reason) and remember that ties the storyboard to
   the recording account.
3. **Confirm the route in the running app.** Open the preview in a browser and
   walk it yourself once. The code shows a route exists; only the app shows
   whether the screen paints, what it is called today, and what sits in the way.
   Note anything that has to be waited for: a dashboard resolves its route
   seconds before its widgets exist, and the first beat of the current video once
   filmed an empty window because of it.
4. **Check the account's data is fit to film.** Open the records the video will
   show and look, against today's date, for: dates far in the past, completion
   dates after the deadline (a red "627 d later"), tasks done out of order (task
   2 done while task 1 has not started), and empty Updates or Activiteit tabs
   the voice talks about. If any of that would be on screen, tell her before
   writing the storyboard and pick another record or ask her what to do. Never
   explain it away as correct: on 2026-10-05 the agent did, and she caught it
   after the video was rendered.
5. **Check every claim the narration will make against the code.** Who can do
   it, where it starts, what happens next. "Vanaf hier activeer je het bij een
   klant" was wrong (a flow is activated at the client or through the Excel
   import) and cost a full re-narration. If the code does not settle a claim,
   leave it out or ask her.

If you cannot locate the screen, ask her for a screenshot. Do not guess a
selector: a wrong one costs a whole recording and reports itself as a timeout.

## Phase 3: The questions, at most four

One per message, in her language, each carrying what you already found so she is
correcting a proposal rather than filling in a form.

| ask | why the code cannot answer it |
| --- | --- |
| which route, when more than one leads there | the code shows both; which one the team means is not in it |
| does the viewer already know the way? | decides whether the video opens on the dashboard or deeper in |
| where is it done? | the picture has to show the thing the voice says is finished |
| what is deliberately left out? | edge cases and settings that only confuse |

**"Where is it done?" is not a formality.** The current video's own ending was
the failure it exists to prevent: the voice said the task was in your list while
the picture stayed on the dashboard. Ask it every time, and let the answer decide
the final beat.

Everything else you propose rather than ask: example values, field names, length,
how many chapter cards, tone. The probe gate in Phase 4 is where she corrects
them, and correcting something concrete is faster than answering questions about
something that does not exist yet.

## Phase 4: Write, validate, probe, present

Write the storyboard to `.fk-po/storyboards/<slug>.mjs` (next to `app.env`),
**never inside a repo**. That folder survives the session, so the next request
for the same subject finds it. A storyboard imports nothing from the harness;
copy the shape of `storyboards/taak-aanmaken.mjs`.

The default house shape, unless the answers say otherwise: logo intro, an opening
card with a chapter number, the steps in the app, a closing card, a final beat
back in the app, 45 to 75 seconds in total.

Give every card a `cardDesign`, picked at random from all six: `balken`,
`stappen`, `stromen`, `flows`, `clienten`, `deadlines` (Tim approved all six on
2026-10-05). Do not use the same design twice in a row within one video. They
hold 4 to 5 seconds on their own. `stappen` draws one node per chapter,
counted from the highest `cardStep`. The bumpers show "Hoofdstuk NN" unless
`cardEyebrow` replaces it.

Then, in order:

1. **Validate.** `validateStoryboard(beats, meta)` from `storyboard.mjs`. Fix
   your own storyboard and revalidate until it passes. **She never sees a schema
   error** - that is your mistake, not a decision she has to make.
2. **Probe.** `npm run make -- <storyboard> --probe` from the harness root. It
   validates again, then screenshots every beat into
   `.fk-po/work/<slug>/probe-N/probe/`. Exit 0 means every selector resolved;
   exit 3 means at least one did not, and `probe/report.json` names each one.
   A probe runs every action, so a storyboard that submits something (a leave
   request) leaves that record behind: reset the account before recording. On a failure, re-resolve from the code and
   probe once more. If it fails again, ask her for a screenshot of that screen
   rather than guessing a third time.
3. **Look at every probe screenshot yourself** before she does: is the data fit
   to film (Phase 2, step 4), and does each screen show what its sentence says?
4. **Present.** The probe prints the script (`script.txt` in the probe dir):
   every subtitle, card text and spoken variant, literally, with an estimated
   length and a hash. Paste that text to her verbatim, never a paraphrase: a
   summary is how a wrong product claim got past her on 2026-10-02. Add the
   screenshots from `probe/` and the storyboard's absolute path. Then ask for
   her OK on that text.

   **Timing.** The video has to flow: no silences, no voice on the first frame.
   narrate already keeps every pause inside a line to 0.5s, starts the voice
   0.6s after the intro and after each card, and lets a screen beat outlast its
   voice by at most 1s. So `minSec` only matters on a card; on a screen beat
   leave it out. What narrate cannot fix is an action that takes longer than
   its sentence: the probe prints "the clicks take Xs, the sentence about Ys"
   for each such beat. Shorten the waits in that action or give the beat more
   to say, and probe again, before she sees the script.

   Over 75 seconds, offer to split it into two videos. All three of her first
   videos ran 1:43 to 2:03; a long one is her choice, not a default.

**Nothing expensive runs before that OK.** The probe is the cheap thing precisely
so this gate can be used freely: if she wants the route changed, change it and
re-probe rather than defending the first attempt.

### Known traps on the recording account

These came out of Melissa's first videos and lived only in her notes until
2026-10-06:

- **No real e-mail address on screen.** The seeded team has invented names but
  real work addresses. Use the demo users Noor van Dijk and Jasper Koning
  (read their addresses off the app's user list) wherever a person or owner shows,
  including import files. `/settings` opens on Accountgegevens with the
  signed-in address: navigate straight to `/settings/manage-data` instead of
  clicking through.
- **A control below the fold gets its own beat.** `run.click` scrolls the
  element into view, but a beat waits its pre-roll before acting, so a scroll
  inside the beat that names the button comes too late: the voice says "klik
  op Opslaan" over the wrong part of the screen. Scroll in the beat before.
- **A new flow template opens with one empty task row.** A beat that adds a
  step before filling the first task leaves a nameless task and saving fails.
- **Saving with a name that already exists does nothing visible.** The editor
  swallows the 422; on "the save did nothing", check for a duplicate name before
  suspecting the selector.

## Phase 5: Narrate, record, render

From the harness root:

```sh
npm run make -- <storyboard> --approved <hash>
```

The hash is the one from the script she approved. Without it, or after any
edit to the text since, `make` exits 2 and prints the current script: show it
to her and ask again. Never pass a hash she has not seen, and never chain a
probe and a paid run in one command. This holds for re-runs too: a fix after
her feedback is new text, so it needs a new OK.

The voice is Fenna at stability 0.5 on `eleven_v3`, her house voice (she chose
Fenna on 2026-09-13 as the only voice lively enough; on v4 Fenna has a slight
English accent, so she stays on v3). The camera does not zoom (`maxScale` 1.0 in `tweaks.ts`), also her
call. These are house style: change them in the harness, not in a memory note. Add `--voice man` or
`--voice vrouw` only when she asks for another voice. Each MP4 gets a `.json`
beside it naming the voice, model and stability, because ElevenLabs cannot tell
you afterwards which voice an earlier video used. That narrates, records and renders into a fresh
`.fk-po/work/<slug>/run-N`, and
prints the MP4 and `.vtt` paths in `.fk-po/videos/`. Narration reuses a take
from `.fk-po/tts-cache/` when the spoken text, voice and stability are unchanged,
so only a TEXT change costs ElevenLabs credit (the script is one take, so one
changed sentence re-buys the whole take). When she wants a different READ of
the same text, add `--fresh`: that buys a new take and replaces the cached one.
Without it a re-run returns the identical voice. A FLOW or TIMING change is the
same command. A pure LOOK change is render alone, against an earlier run:
`npm run render -- --work <run dir>`, or the studio in Phase 6.

## Phase 6: Change how it looks without re-recording

Every visual knob is in `remotion/tweaks.ts`: camera zoom and easing, card
designs and durations, music and cue levels, subtitle style, the intro and outro
clips. Nothing in that file touches the recording or the voice.

For a live preview against an existing run:

```sh
npm run studio -- --work <run dir>   # http://localhost:3211
```

Edit `tweaks.ts`, the preview reloads itself, scrub to the frame she dislikes,
change the number, look again. Render when she is happy. On her Mac the studio
runs in the foreground, so start it as a background command and stop it when
she is done; inside the dev sandbox it runs in a container, stopped with
`docker rm -f fk_help_studio`.

Prefer this loop over re-rendering repeatedly: a render is minutes, the preview
is instant.

## Phase 7: Review with her

1. Watch it yourself first, every sentence of it:

   ```sh
   npm run frames -- <mp4>
   ```

   That grabs one frame per subtitle cue plus the last frame, and prints each
   frame's path with its caption. Read **all** of them. For each: the camera
   is on the thing the sentence names, the subtitle does not cover it, no field
   or panel is cut off at the edge, the data on screen is fit to film, and no
   card or caption has an em dash. Do not say the video is checked after a
   handful of frames: on 2026-10-02 that claim was made while the subtitles
   covered the timeline the voice was describing.

2. Show her the frames inline plus the MP4 path so she can play it, with one line
   on what the video shows. Then ask what she wants changed. Expect several
   rounds - that is the normal shape of this work, and the tweak loop in Phase 6
   is what makes the rounds cheap. If she dislikes how a sentence SOUNDS rather
   than what it says, that is `npm run make -- <storyboard> --fresh`.

## Phase 8: Hand it over

Give her the MP4 path, the `.vtt` path, and a short list of anything you could
not do.

Always add the **help-article text** for the video, unasked: she asked for it
after every video. Dutch, built from the approved script, no em dashes: a title,
one or two sentences on who it is for and when, the steps as a numbered list in
the order the video shows them, and a short "Goed om te weten" for anything the
video leaves out. Use the screen's labels exactly as the app shows them.

If you saw something wrong in the product or the demo data along the way, list
it and offer `fk-po-ticket` for it. Do not file it yourself. Nothing is uploaded, nothing is published, and no ticket is created:
publishing a help article is a separate, unbuilt piece of work.

If she wants the video attached to a Jira ticket, that is `fk-po-ticket`'s
attachment helper, and only on her explicit ask.

## Hard constraints

- **Never print credential values or the ElevenLabs key**, in chat, in captions, or in a filename.
- **Never commit, never push, never write inside the repos.** Storyboards go to `.fk-po/storyboards/`, runs to `.fk-po/work/`, finished videos to `.fk-po/videos/`.
- **All pipeline output is Dutch** and free of em dashes. The chat follows her language.
- **Never spend voice credit to fix a look problem.** If the change is visual, do not re-narrate.
- **Do not edit a storyboard to point at a different feature.** Selectors in it were measured against the running app; guessing new ones produces a video of the wrong thing, or a run that hangs for 30 seconds on a selector that no longer matches.
- The recording writes real data into the recording account. Keep to storyboards that create throwaway records, and give anything a run creates a name no seeded record has: a probe and a recording each leave one behind.
- **Never delete a seeded record** to free a name or tidy up. On 2026-10-02 deleting the seeded "BTW Aangifte" template took it away from the five demo flows that used it. Rename your own record instead, and only claim the account is clean after listing what is left.
- **No Monitor or watch per step.** The harness commands run in the foreground and print their result; a watch on each one cost twelve turns answering expired watches in one session.

## What this skill does not do

- It does not invent a selector. Every one comes from the frontend source or a screenshot she supplies; a guessed selector costs a whole recording and reports itself as a timeout.
- It does not skip the probe gate to save a few minutes. The gate is what makes an ElevenLabs bill the last thing spent rather than the first.
- It does not publish a help article. There is no hosting for the video yet, which is the open question on FK-633.
- It does not file tickets. Bugs found while recording go to `fk-po-bug-video`, ideas to `fk-po-ticket`.

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

Only after she approves the probe do `narrate`, `record` and `render` run.

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

Then check, in order. STOP with the matching Dutch fix-it message if a check
fails; never work around a failed check.

1. **Deps installed**: `node_modules/` exists in the harness root. If not: "De video-harness is nog niet geinstalleerd. Volg melissa-setup.md, onderdeel bug-video (eenmalig, ongeveer 5 minuten)." Offer to run `npm run setup` in the harness root. In Cowork that needs `registry.npmjs.org` and the Playwright CDN on the network allowlist; in Claude Code on her Mac there is no allowlist and it just runs.
2. **Browsers path**: export `PLAYWRIGHT_BROWSERS_PATH="$HOME/FlowKeeper/.fk-po/pw-browsers"` (or the `/sessions/*/mnt/FlowKeeper/.fk-po/pw-browsers` equivalent) for **every** harness command in this session. On a Mac the home is not ephemeral, but keep the export anyway: it puts the browsers outside the harness root, so re-cloning or moving the checkout does not cost another download.
3. **App credentials**: `.fk-po/app.env` holds the keys for the account the storyboard names in `meta.account`. Help videos record as `help`: `FK_HELP_EMAIL`, `FK_HELP_PASSWORD`, and `FK_HELP_BASE_URL` when that account is not on the same host as the bug-video one. There is no fallback to `FK_ACC_*` on purpose. Never print their values.
4. **Account display names**: the assignee field and the colleague picker are matched by the names the account actually shows. `FK_HELP_OWNER_NAME` (the account's own display name) and `FK_HELP_COLLEAGUE_NAME` (a colleague in the same company) must be set for anything but the dev-stack account, and `FK_HELP_COMPANY_NAME` too when the account belongs to more than one company, which every seeded preview account does. Without them a run waits 30 seconds on a name that is not on screen and then fails, which reads as a broken selector rather than as missing config. If you do not know them, ask her rather than guessing.
5. **Voice key**: `.fk-po/eleven.env` exists and holds `ELEVENLABS_API_KEY`. Without it `narrate.mjs` produces silent beats and the video has no voice and no subtitle timings, which is not a help video. If it is missing: "Voor de stem is een ElevenLabs-sleutel nodig in ~/FlowKeeper/.fk-po/eleven.env. Vraag die aan Tim." Never print the key.
6. **Recording account language**: the account must be Dutch, or the picture is English while the voice is not. A seeded preview account already is.

## Phase 1: The subject

She types one line in product words: "hoe je een taak aanmaakt", "hoe je een
klant koppelt aan een flow". That is all you ask for at this stage.

If a storyboard for it already exists in `storyboards/`, say so and offer the
cheaper path instead of rebuilding it: re-record it (the app changed), change its
text, or only change how it looks. Jump to Phase 5 for the first two and to the
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

Write the storyboard to the session work directory, **never inside a repo**:

```sh
WORK=$(mktemp -d)/help-<slug>
mkdir -p "$WORK"
# storyboard at "$WORK/<slug>.mjs"
```

The default house shape, unless the answers say otherwise: logo intro, an opening
card with a chapter number, the steps in the app, a closing card, a final beat
back in the app, 45 to 75 seconds in total.

Then, in order:

1. **Validate.** `validateStoryboard(beats, meta)` from `storyboard.mjs`. Fix
   your own storyboard and revalidate until it passes. **She never sees a schema
   error** - that is your mistake, not a decision she has to make.
2. **Probe.** `FK_STORYBOARD="$WORK/<slug>.mjs" npm run probe -- --work "$WORK"`.
   Exit 0 means every selector resolved; exit 3 means at least one did not, and
   `probe/report.json` names each one. On a failure, re-resolve from the code and
   probe once more. If it fails again, ask her for a screenshot of that screen
   rather than guessing a third time.
3. **Present.** Show her the beats as plain Dutch sentences, the screenshots from
   `probe/`, and the storyboard's absolute path so she can hand the file to a
   developer when the video needs re-recording later. Then ask for her OK.

**Nothing expensive runs before that OK.** The probe is the cheap thing precisely
so this gate can be used freely: if she wants the route changed, change it and
re-probe rather than defending the first attempt.

## Phase 5: Narrate, record, render

Three stages, deliberately separate because they cost different things. Run from
the harness root.

| stage | command | cost | run it when |
| --- | --- | --- | --- |
| narrate | `npm run narrate -- storyboards/<x>.mjs --work "$WORK"` | ElevenLabs credit | the TEXT changed |
| record | `FK_STORYBOARD=storyboards/<x>.mjs npm run record -- --work "$WORK"` | browser, several minutes | the FLOW or TIMING changed |
| render | `npm run render -- --work "$WORK"` | a few minutes | any VISUAL change |

They are ordered: narrate writes the clock that record plays against, so a
changed text means all three. A pure look change means render alone, against the
work directory of an earlier run.

`render-help.mjs` prints the final MP4 path. It writes to `.fk-po/videos/`,
outside any git repository, alongside the subtitle file.

**Never re-record into a work directory that already has a recording.** Playwright
names each webm after its page, so a retry adds a file and the concatenation step
joins them all. Three attempts once produced a 3m10s raw video for a 56 second
session, with no error and every beat placed against a picture minutes behind. A
new directory per attempt is the whole fix.

**Verify the recording before rendering it.** Compare `raw.mp4`'s duration
against the last timestamp in the work directory's event log. If the video is
much longer, the directory had an earlier attempt in it (see Phase 2) and every
beat will be misplaced. Start over in a clean directory rather than rendering it.

## Phase 6: Change how it looks without re-recording

Every visual knob is in `remotion/tweaks.ts`: camera zoom and easing, card
designs and durations, music and cue levels, subtitle style, the intro and outro
clips. Nothing in that file touches the recording or the voice.

For a live preview against an existing run:

```sh
npm run stage -- --work "$WORK"
npm run studio            # http://localhost:3211
```

Edit `tweaks.ts`, the preview reloads itself, scrub to the frame she dislikes,
change the number, look again. Render when she is happy. Stop the studio with
`docker rm -f fk_help_studio`.

Prefer this loop over re-rendering repeatedly: a render is minutes, the preview
is instant.

## Phase 7: Review with her

1. Watch it yourself first. Pull 4 or 5 frames with ffmpeg (the title, a chapter
   card, a beat mid-narration, the ending) and read them:

   ```sh
   ffmpeg -y -loglevel error -ss <sec> -i <mp4> -frames:v 1 <frame.png>
   ```

   Check: the subtitle matches what is being said, the camera is looking at the
   thing the voice is describing, no field or panel is cut off at the frame edge,
   and no card or caption contains an em dash.

2. Show her the frames inline plus the MP4 path so she can play it, with one line
   on what the video shows. Then ask what she wants changed. Expect several
   rounds - that is the normal shape of this work, and the tweak loop in Phase 4
   is what makes the rounds cheap.

## Phase 8: Hand it over

Give her the MP4 path, the `.vtt` path, and a short list of anything you could
not do. Nothing is uploaded, nothing is published, and no ticket is created:
publishing a help article is a separate, unbuilt piece of work.

If she wants the video attached to a Jira ticket, that is `fk-po-ticket`'s
attachment helper, and only on her explicit ask.

## Hard constraints

- **Never print credential values or the ElevenLabs key**, in chat, in captions, or in a filename.
- **Never commit, never push, never write inside the repos.** Work directories go in scratch; finished videos go to `.fk-po/videos/`.
- **All pipeline output is Dutch** and free of em dashes. The chat follows her language.
- **Never spend voice credit to fix a look problem.** If the change is visual, do not re-narrate.
- **Do not edit a storyboard to point at a different feature.** Selectors in it were measured against the running app; guessing new ones produces a video of the wrong thing, or a run that hangs for 30 seconds on a selector that no longer matches.
- The recording writes real data into the recording account. Keep to storyboards that create throwaway records.

## What this skill does not do

- It does not invent a selector. Every one comes from the frontend source or a screenshot she supplies; a guessed selector costs a whole recording and reports itself as a timeout.
- It does not skip the probe gate to save a few minutes. The gate is what makes an ElevenLabs bill the last thing spent rather than the first.
- It does not publish a help article. There is no hosting for the video yet, which is the open question on FK-633.
- It does not file tickets. Bugs found while recording go to `fk-po-bug-video`, ideas to `fk-po-ticket`.

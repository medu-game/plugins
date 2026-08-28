---
name: fk-po-help-video
description: Record a Dutch help-centre video of a FlowKeeper feature from a storyboard, with voice-over, subtitles and chapter cards, and hand the PO an MP4 plus a subtitle file to review. WORK IN PROGRESS - only the existing "Een taak aanmaken" storyboard can be recorded; a new subject still needs a developer. Use when the PO wants to show users how something works - triggers on "help-video", "uitlegvideo", "instructievideo", "video voor de helppagina", "hoe leg ik dit uit aan gebruikers". Do not trigger when something is broken ("er gaat iets mis" -> fk-po-bug-video) or for a how-does-it-work question with no video in it ("hoe werkt X nu" -> fk-po-explore).
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

## What this skill can and cannot do today

It is deliberately narrow while the interview that writes a storyboard is still
being built.

**Can**: record, re-record, re-narrate and re-render the existing storyboards,
show the PO the result, and change how it looks (timing, zoom, colours, music)
without re-recording anything.

**Cannot**: invent a video about a new subject. The storyboard is still a file a
developer writes. If she asks for a subject that has no storyboard, say so
plainly and offer to note it for Tim - do not improvise one, and do not adapt an
existing storyboard to a different feature by editing selectors.

List what exists by reading `storyboards/*.mjs` in the harness root; each file's
`meta.title` is the video's subject. At the time of writing that is one file,
`taak-aanmaken.mjs` ("Een taak aanmaken").

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

1. **Deps installed**: `node_modules/` exists in the harness root. If not: "De video-harness is nog niet geinstalleerd. Volg melissa-setup.md, onderdeel bug-video (eenmalig, ongeveer 5 minuten)." Offer to run `npm run setup` in the harness root.
2. **Browsers path**: export `PLAYWRIGHT_BROWSERS_PATH="$HOME/FlowKeeper/.fk-po/pw-browsers"` (or the `/sessions/*/mnt/FlowKeeper/.fk-po/pw-browsers` equivalent) for **every** harness command in this session.
3. **App credentials**: `.fk-po/app.env` exists and holds the keys for the account the storyboard names in `meta.account`. Help videos record as `help`: `FK_HELP_EMAIL`, `FK_HELP_PASSWORD`, and optionally `FK_HELP_BASE_URL` when that account is not on the same host as the bug-video one. There is no fallback to `FK_ACC_*` on purpose. A missing key stops the run with a message naming it. Never print their values.
4. **Account display names**: the assignee field and the colleague picker are matched by the names the account actually shows, and the storyboard's defaults are the dev-stack account's. Recording as the acceptance help account means `FK_HELP_OWNER_NAME` (the help account's own display name) and `FK_HELP_COLLEAGUE_NAME` (a colleague in the same company) are set for the record command. Without them the run hangs for 30 seconds on a name that is not on screen, then fails. If you do not know them, ask her rather than guessing.
5. **Voice key**: `.fk-po/eleven.env` exists and holds `ELEVENLABS_API_KEY`. Without it `narrate.mjs` produces silent beats and the video has no voice and no subtitle timings, which is not a help video. If it is missing: "Voor de stem is een ElevenLabs-sleutel nodig in ~/FlowKeeper/.fk-po/eleven.env. Vraag die aan Tim." Never print the key.
6. **Recording account language**: the account must be set to Dutch, or the picture is English while the voice is Dutch. Confirm with her which account is being recorded and that it is Dutch before spending a recording.

## Phase 1: Pick the storyboard

One question, multiple choice, in her language: which of the existing videos does
she want, and what does she want to happen to it. The three realistic answers map
to three very different costs, so name the cost when you ask:

- **Opnieuw opnemen** - the app changed, or the flow in the video is wrong.
- **Alleen het uiterlijk** - timing, zoom, colours, music, card design. No recording, no voice.
- **De tekst klopt niet** - narration or subtitles. Costs voice credit and a re-render, but no recording.

If she describes a subject with no storyboard, stop here and use the "cannot"
answer above.

## Phase 2: Choose a work directory

Make a fresh scratch directory per attempt, outside the repos:

```sh
WORK=$(mktemp -d)/help-<slug>
mkdir -p "$WORK"
```

**Never re-record into a work directory that already has a recording.** Playwright
names each webm after its page, so a retry adds a file and the concatenation step
joins them all. Three attempts once produced a 3m10s raw video for a 56 second
session, with no error and every beat placed against a picture minutes behind. A
new directory per attempt is the whole fix.

## Phase 3: Run only the stages that changed

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

**Verify the recording before rendering it.** Compare `raw.mp4`'s duration
against the last timestamp in the work directory's event log. If the video is
much longer, the directory had an earlier attempt in it (see Phase 2) and every
beat will be misplaced. Start over in a clean directory rather than rendering it.

## Phase 4: Change how it looks without re-recording

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

## Phase 5: Review with her

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

## Phase 6: Hand it over

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

- It does not write a storyboard for a new subject. That is the interview still being built; until it lands, a new video needs a developer.
- It does not publish a help article. There is no hosting for the video yet, which is the open question on FK-633.
- It does not file tickets. Bugs found while recording go to `fk-po-bug-video`, ideas to `fk-po-ticket`.

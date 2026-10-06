# repro-harness

PO bug-repro video pipeline. Used by the `fk-po-bug-video` Cowork skill.

Pipeline: agent-written `scenario.mjs` (imports only `helpers.mjs`)
-> `record-repro.mjs` (Playwright capture: webm + events.jsonl + raw.mp4)
-> `render.mjs` (Remotion `ReproVideo` template: annotated Full HD MP4, 1920x1080 @ 30 fps).

All video text (captions, title card, badge) is English, per the team's
English-everywhere convention.

One-time setup (persists on the mounted `~/FlowKeeper` volume):

    export PLAYWRIGHT_BROWSERS_PATH="$HOME/FlowKeeper/.fk-po/pw-browsers"
    npm run setup

Feasibility gate / end-to-end smoke (no credentials needed, uses a file:// page):

    npm run spike

Real runs need `~/FlowKeeper/.fk-po/app.env`:

    FK_ACC_BASE_URL=https://app-acc.flowkeeper.nl
    FK_ACC_EMAIL=<acceptance test account email>
    FK_ACC_PASSWORD=<acceptance test account password>

Unit tests: `npm test`.

Note: this harness intentionally shares nothing with `scripts/sandbox-e2e/`.
It targets the acceptance environment from Claude Cowork and needs no docker,
no dev-stack lock, and no dev certificates.

## Help videos (FK-633)

    npm run make -- <storyboard> --probe   # walk the route, screenshot every beat, print script + hash
    npm run make -- <storyboard> --approved <hash>  # narrate + record + render into a new run dir
    npm run frames -- <video.mp4>          # one frame per subtitle cue, for the review

Runs land in `.fk-po/work/<slug>/run-N`. Narration reuses a cached take from
`.fk-po/tts-cache/` when the spoken text is unchanged; `FK_NARRATE_STUB=1`
forces a silent track without spending credit, and `--fresh` buys a new take of
unchanged text when the read itself should change. The three stages underneath,
which can still be run on their own:

| stage | command | cost | re-run when |
| --- | --- | --- | --- |
| narrate | `npm run narrate -- storyboards/<x>.mjs --work <dir>` | ElevenLabs credit | the TEXT changed |
| record | `FK_STORYBOARD=storyboards/<x>.mjs npm run record -- --work <dir>` | dev stack + browser | the FLOW or TIMING changed |
| render | `npm run render -- --work <dir> --title "..."` | a few minutes | any VISUAL change |

Reset after a probe that invited users: `npm run reset-probe-users -- --match proef- --company "<name>"`
lists the open users whose address contains the marker; `--apply` archives them, skipping
already-archived ones and waiting out a 429.

### Tweaking the look

Every visual knob lives in `remotion/tweaks.ts`. Nothing in that file touches
the recording or the voice, so you never re-record or re-narrate to change how
it looks.

For a live preview:

    npm run stage -- --work <dir>     # point it at an existing run
    npm run studio                    # http://localhost:3211

Edit `remotion/tweaks.ts` and the preview reloads by itself. Scrub the
timeline, find the frame you dislike, change the number, look again. Render
only when you are happy. On a Mac it runs directly (Ctrl+C stops it). Inside
the claude-sandbox, which publishes no ports to the Mac, it runs in a container
instead: stop that with `docker rm -f fk_help_studio`.

### Voice

- `fenna` — Fenna (`p4efl2GlWK0o6sAQEEkp`, default, `eleven_v3`, stability 0.5): Melissa's house voice since 2026-09-13; on v4 she has a slight English accent
- `man` — Flowkeeper NL man (`U4S7eJBqHUvUlS4hiNhx`, `eleven_v4`)
- `vrouw` — Flowkeeper NL vrouw (`a0pCzzi71BFyUJUDzeTq`, `eleven_v4`)

Choose with `npm run make -- <storyboard> --approved <hash> --voice vrouw`. Every
MP4 gets a `.json` beside it naming the voice, model and stability used.

The key lives in `.fk-po/eleven.env`, never on a command line.

A beat may carry `speech` alongside `narration`: what is said, separate from
what is shown. Dutch stress needs it, because "een" is the article and "één"
is the number and only one of them is right to read out loud.

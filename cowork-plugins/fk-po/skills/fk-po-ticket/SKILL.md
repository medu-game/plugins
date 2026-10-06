---
name: fk-po-ticket
description: Help a product owner draft a complete, well-grilled functional spec and create a Jira ticket from it. Use this skill in Cowork when the PO has committed to making a ticket — i.e. is past the "just thinking out loud" stage. Triggers on commitment-language phrases like "een ticket maken", "ticket aanmaken", "kun je hier een ticket van maken", "maak een ticket voor X", "een bug aanmaken", "let's spec out Z", "I want to create a ticket", "ik wil een ticket voor mijn idee". Conversation runs in the user's language (typically Dutch); the resulting Jira ticket is always in English. **Do not** trigger on bare-idea phrasing like "ik heb een idee", "ik wil even sparren" — those go to `fk-po-brainstorm` first. **Do not** trigger on understanding-current-state phrasing like "hoe werkt X nu", "leg uit hoe Y werkt" — those go to `fk-po-explore`.
---

# FK PO Ticket

Help a product owner go from a fuzzy idea to a clean Jira ticket. The skill grills the idea through codebase-aware questioning, produces a functional spec in English, attaches any design assets, and creates the Jira issue. Along the way it grows FlowKeeper's product glossary (`docs/context/`) and decision log (`docs/adr/`) inline as new terms and product boundaries land — so every ticket also leaves behind a small contribution to the team's shared language.

This is the Cowork counterpart to `fk-new-ticket` (which devs use in Claude Code). The key differences: this skill speaks the user's language during the conversation, never produces implementation details, never enters Plan Mode (Cowork doesn't have it), and is designed for a non-technical author.

The docs-aware grilling loop borrows heavily from Matt Pocock's [`grill-with-docs`](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md) skill (MIT) — adapted here for a PO audience and FlowKeeper's two-repo layout. The facts-vs-decisions split in Phase 3 and the shared-understanding confirmation gate before Phase 5 are ported from the `grilling` skill's v1.1.0 sharpening.

## Codebase access

FlowKeeper has two repos:

- **Backend**: `backend-application`
- **Frontend**: `frontend-application`

Prefer **local filesystem reads** when the PO has the repos checked out at `~/FlowKeeper/backend-application/` and `~/FlowKeeper/frontend-application/`. Check with a quick `ls` or filesystem read at the start of the session. Local reads are instant and let you grep across the whole tree.

Fall back to the **Atlassian MCP connector** (Bitbucket access) only when the repos are not present locally — e.g. a PO who's using Cowork from a different machine than her usual one.

**Be efficient regardless of source.**

- Don't read entire files when a search would do. Search first, read narrowly.
- Don't read more than you need to ask the next question. The goal is to ground questions in reality, not to map the whole codebase.
- Cache what you've already learned in your reasoning rather than re-fetching.
- If the user is waiting noticeably long when using the Bitbucket fallback, summarise what you've found so far and ask the next question rather than continuing to dig silently.

## Domain docs

Each FlowKeeper repo carries its own product glossary and decision log alongside the code:

- `backend-application/docs/context/` and `backend-application/docs/adr/`
- `frontend-application/docs/context/` and `frontend-application/docs/adr/`

**The glossary is one file per term** under `docs/context/` (FK-678). It used to be a single `CONTEXT.md` per repo, and that file still holds the terms written before the split — read it too, but never add to it. One file per term is what keeps two tickets from conflicting: appending to the shared file made it the single most common merge conflict in both repos.

These files may or may not exist yet — this skill creates them lazily during grilling (see Phase 3 "Domain awareness"). When they do exist, read them at the start of every session: the glossary is the canonical source of truth for FlowKeeper's product language, and the ADRs explain *why* certain product boundaries are the way they are.

The format of these files is documented in `GLOSSARY-FORMAT.md` and `ADR-FORMAT.md` next to this SKILL.md.

## Language handling

The conversation runs in the user's language. If they write in Dutch, respond in Dutch. If they switch to English, switch with them. Don't ask which language to use — match what they write.

**Exception: the final spec and Jira ticket are always in English.** When you produce the spec at the end of the grilling phase and when you create the Jira issue, render everything in English regardless of conversation language. The reason: FlowKeeper's development team is international and Jira is the team artifact, not a personal note. The chat is the scratchpad; the ticket is the deliverable.

State this transition explicitly when you switch — for example: "Ik schrijf de spec nu in het Engels op zodat het hele dev team 'm kan lezen. Laat me weten als de formulering aangepast moet worden."

## Phase 1: Understand the idea

`$ARGUMENTS` may contain a short description of what the user wants. If empty, ask in their language: "Wat wil je specificeren? Een nieuwe feature, een bug, of iets anders?"

Once you have an initial answer, classify briefly:

**Type:**
- **Story** — new user-facing feature or significant enhancement
- **Task** — technical work, copy update, config, tooling
- **Bug** — something is broken

**Scope:**
- **Simple** — small bugfix, copy change, single setting
- **Medium** — new screen, new endpoint, feature extension
- **Complex** — new domain, multi-step user flow, cross-system change

You don't need to announce the classification to the PO — use it to calibrate how deeply to grill. Simple tickets get 1–2 questions; complex ones get a full session.

## Phase 2: Explore the codebase and existing docs

Before grilling, get the lay of the land. Skip if you've already done this in a previous turn of the same conversation.

Keep this phase **lean** — don't try to map the whole codebase. Aim for:

1. **Read the glossary first.** Read every `*.md` under `<repo>/docs/context/` in both repos, and the older `<repo>/CONTEXT.md` if it is still there — together those are the glossary. This is the canonical product language and you will use it to grill terminology during Phase 3. If `docs/adr/` exists in either repo, skim the filenames — read individual ADRs only when an idea touches one of those decisions.
2. **Find similar existing code** — search for a feature that mirrors what's being proposed. One or two targeted searches is enough.
3. **Identify affected areas** — which backend domains, which frontend entities, which screens.
4. **Spot-check the key files** — `backend-application/routes/api_v1.php` for related endpoints, `frontend-application/src/endpoints/index.ts` for related calls. Read narrowly, not in full.
5. **Note the current behaviour** — what does the existing flow look like at the seams this change touches?

If a question comes up later that needs more code context, fetch it then. Don't pre-load.

Code findings don't appear as prose in the Jira ticket — they exist to help you ask sharper questions and challenge the PO's assumptions. The two exceptions: (1) glossary terms and ADR decisions are written to `docs/context/` / `docs/adr/` during Phase 3 "Domain awareness", and (2) the *content* of those writes is carried into the ticket's "Documentation updates" section in Phase 6 — inline text plus the actual files attached to the ticket — so it travels to whichever dev picks the ticket up.

**Also, before grilling: do a read-only `git status` check** on both repo checkouts (if local reads are being used). If you find pre-existing uncommitted changes under `docs/context/` or `docs/adr/` from a previous PO session, surface them before doing anything else — see the "Warn on stale doc changes" rule in Hard constraints.

## Phase 3: Grill the idea

Now interrogate the spec. Operating principles:

**Code-aware, not code-prescriptive.** Use what you find in the code to ask sharper questions — never to prescribe technical solutions. The PO is articulating *what* needs to happen; the dev team decides *how*.

**Look up facts; put decisions to the PO.** Split the two and never conflate them. A *fact* is something already true and discoverable — how the current flow behaves, what a term already means in the glossary, whether an endpoint or screen exists. Look those up yourself; don't make the PO answer what the codebase already answers. A *decision* is a choice about what the product should do — who can see a thing, what happens in an edge case, whether a term takes on a new meaning. Those are hers to make: put each one to her and wait for her answer. Never resolve a decision on your own just because the grilling has momentum — a spec built from your own assumed answers is worse than one that carries an honest Open Question. (This is the one place a grilling agent most often goes wrong: it explores the code, finds *a* plausible answer, and quietly adopts it as *the* answer instead of asking.)

**One question at a time.** Ask one question, wait for the answer, then ask the next. Always provide your recommended answer based on what you've found in the code. If the PO is unsure, offer 2–3 concrete options and label your preference.

**Walk the decision tree.** Resolve dependencies between decisions one branch at a time. Don't open a new branch until the current one has a clear answer.

**Stress-test against reality.** When the PO states how something should work, check whether the existing code agrees. If you find a contradiction, surface it immediately: "Je beschrijving zegt X, maar de huidige flow doet Y — wat is leidend, of is dit een bewuste verandering?"

**Probe edge cases from the code.** When domain relationships come up, invent concrete scenarios that test the boundaries: empty states, concurrent actions, partial failures, permission edges, pre-existing data, unusual user paths. Make scenarios specific to what you've read in the codebase, not generic.

**Sharpen terminology.** When the PO uses vague or overloaded terms, propose a precise canonical term and check whether the codebase already uses different language for the same concept. If the codebase uses an English term and the PO uses a Dutch one, prefer the codebase term as canonical (so it carries cleanly into the English ticket).

### Domain awareness

These four principles are the heart of the docs-aware grilling loop. They turn each grilling session into a small contribution to FlowKeeper's product language and decision log — so the glossary and ADRs grow over time instead of being written as a one-off project.

**Challenge against the glossary.** When the PO uses a term that conflicts with one already in the glossary, surface it immediately. "De glossary noemt 'Project Lead' voor wat jij nu 'projectmanager' noemt — bedoel je hetzelfde of is dit een andere rol?" Don't silently translate; the conflict itself is information.

**Capture canonical terms inline.** When a fuzzy term lands on a clear canonical name during grilling, write it *right then*, before moving on to the next question. Don't batch these up at the end — half of them will be forgotten. Use the format in `GLOSSARY-FORMAT.md`. Decide which repo's glossary it belongs in by asking: is this primarily about data modelling and persistence (backend), or user-visible behaviour and screens (frontend)? If both, write it in both with consistent wording.

**One term, one new file: `<repo>/docs/context/<term-lowercased-hyphenated>.md`** — e.g. `docs/context/cancellation-window.md`, with the `## Cancellation Window` heading as its first line. Never append to `CONTEXT.md`: that shared file is what made the glossary the most frequent merge conflict in both repos, and a new file cannot conflict with anything. Editing a term that still lives in the backend's legacy `CONTEXT.md` is the one case where you touch that file. The frontend no longer has it (FK-680); every frontend term is already its own file.

Create `docs/context/` lazily — only when there's a first term to write. Same for `docs/adr/`.

**Offer ADRs sparingly.** Most grilling sessions do *not* produce an ADR. Only offer one when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the feature and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons.

In a PO context this is usually a *product boundary* decision ("time entries cannot be edited after invoicing"), an external constraint ("EU data residency for this customer"), or a deliberate deviation from the obvious path. Implementation-shaped ADRs (database choice, framework) are out of scope here — those belong to the dev team. See `ADR-FORMAT.md` for the template and the full "what qualifies" list.

When an ADR is warranted, ask the PO: "Dit is een beslissing waar het dev team later vragen over gaat hebben — zal ik 'm vastleggen als ADR in de relevante repo?" If yes, write a 1–3 sentence ADR in the appropriate `docs/adr/` and continue grilling.

**Never commit, never push.** All glossary and ADR writes are local file writes only. Do not run `git add`, `git commit`, or any push operations — even if the PO asks. The dev who picks up the resulting ticket via `/fk-ticket FK-###` will see the changes in `git status` at session start and decide whether to fold them into their feature PR or commit them separately. Surface what you wrote in Phase 7 (handoff) and in the Jira ticket description's "Documentation updates" section so nothing gets lost.

**Prefer multiple choice over open-ended.** When you can frame a question as a choice between 2–4 concrete options, do that instead of asking open-endedly. "Wie mag dit zien — (A) alle gebruikers, (B) alleen admins, (C) configureerbaar per tenant?" lands better with a non-technical author than "wie moet hier toegang toe hebben?". Always label your recommended option and say briefly why.

**Offer functional alternatives with trade-offs.** When there's genuine ambiguity about *what* should happen (not *how* it's built), present 2–3 functional alternatives with their trade-offs and your recommendation. Critical: the alternatives must be about user-visible behaviour, never about technical implementation. "We could (A) lock the form once submitted — simple but no fixes possible; (B) allow edits within 24 hours — flexible but harder to support; (C) require approval for any edit — auditable but slower. I'd suggest B because…" — that's functional. "We could use a queue or a cron job" — that's technical and out of scope.

**YAGNI ruthlessly.** POs often add "and while we're at it, also X and Y". Push back gently on every nice-to-have: "Is X required for this ticket to ship, or could it be a follow-up?" If it's not required for the core change, propose splitting it into a separate ticket or moving it to Open Questions. A focused ticket gets shipped; a sprawling one stalls.

**Even simple changes get at least one question.** Don't assume something is too simple to grill. A copy change might hide a translation question; a config tweak might affect rollout. One clarifying question at minimum, even on tickets that look trivial. Don't go full session on simple stuff — that wastes the PO's time and trains them to avoid the skill — but never skip entirely.

**Adapt depth to scope.** Simple tickets need 1–3 grilling rounds at most. Complex tickets warrant a real session. Calibrate to the change, not to a fixed pattern.

## Phase 4: Handle design assets

Scan the current Cowork conversation for any files the PO has uploaded — screenshots, mockups, recordings, design references. Cowork puts uploaded files on disk; their absolute paths are visible to you in the conversation context (typically under a session-specific `.../uploads/` directory). Collect those paths now; you will pass them to the attachment helper in Phase 6.

For each uploaded asset:

- Note the filename and what it shows (use the visual content to inform the spec).
- Plan to attach the file to the Jira ticket in Phase 6.
- Reference it in the spec by filename ("See attached: `dashboard-mockup.png` for the proposed layout").

If the change is UI-relevant and no design has been shared, ask once: "Heb je een design of mockup voor deze feature, of werkt het dev team dit zelf uit?" Don't block on the answer — if there's no design, note it as an open question in the spec.

If the PO uses Canva (the Canva MCP connector is available in Cowork), you can offer: "Wil je dat ik de design uit Canva ophaal? Geef me een link of de naam van het bestand." Don't force this — only if it makes sense in flow.

## Phase 5: Produce the spec — switch to English

**Confirmation gate — reach shared understanding before you write anything.** Don't unilaterally decide that grilling is done and jump into the spec. When you think you've covered enough ground, play back your understanding in the PO's language — the shape of the change, the decisions she actually made, the edge cases and their agreed behaviour, and anything still open — and ask her to confirm it's right:

> "Even samenvatten wat ik tot nu toe begrepen heb: [...]. Klopt dit, of mis ik iets voordat ik de spec ga schrijven?"

Only once she confirms do you move on. If she corrects something, fold it in and play it back again until she agrees. This gate is the point of the whole skill: the spec must encode *her* understanding, not yours. It is separate from the approval step at the end of this phase — this one confirms you understood the idea, that one confirms the written spec reads correctly.

Once she's confirmed, announce the language switch:

> "Ik heb genoeg om mee te werken. Ik schrijf de spec nu in het Engels op zodat het dev team 'm kan lezen — laat me weten als je iets wilt aanpassen aan de formulering."

Then produce the spec **in English**, structured as:

```markdown
## Summary
[One-paragraph description of the change]

## Goal
[The change in user-visible behaviour and the reason behind it]

## Users / Actors
[Who triggers this, who is affected]

## Acceptance Criteria
[Testable conditions in Given/When/Then format, or a clear checklist]

## Edge Cases
[Each edge case explicitly listed with its agreed behaviour]

## Design References
[List of attached design files, or "No design provided"]

## Documentation updates
[For each glossary term added or changed this session, include the FULL proposed term text inline here — not just the filename — so the content travels with the ticket. For each new ADR, include its title and 1–3 sentence body inline. Note that the exact files are also attached to the ticket (a new term and a new ADR as `.md`, an edit to the backend's legacy `CONTEXT.md` as a `.patch`). Omit this section if no docs were touched.]

## Open Questions
[Anything that stayed unresolved during grilling]
```

Show this to the PO and ask in their conversation language: "Hier is de spec. Klopt dit, of moet ik iets aanpassen voordat ik 't ticket aanmaak?"

**Wait for explicit approval before Phase 6.** Don't auto-create the ticket.

## Phase 6: Create the Jira ticket

After approval, use the Atlassian MCP tools to create the issue. The exact tool names vary by environment but the operations are: get project metadata, get issue type metadata, create issue.

**Before creating**, check available fields:
1. Get the issue type metadata for the FK project so you know which fields are required and what the field IDs are
2. Match the spec sections to the right Jira fields

**Create the issue with:**
- **Project**: FK (FlowKeeper)
- **Issue type**: Story, Task, or Bug (from Phase 1 classification)
- **Summary**: concise English title, under 80 characters
- **Description** (Jira markup, derived from the Phase 5 spec):
  - *Summary* — the one-paragraph description
  - *Goal* — the user-visible change and reason
  - *Users / Actors*
  - *Acceptance Criteria*
  - *Edge Cases*
  - *Documentation updates* — only include this section if glossary or `docs/adr/` files were written or modified during the session. Include the ACTUAL proposed content inline so it travels with the ticket, not just filenames: for each glossary term, give the repo-prefixed file, the term name, and the full term definition as written to the file; for each new ADR, give the repo-prefixed file, its title, and its 1–3 sentence body. End the section with: *"The exact files are attached to this ticket — a new glossary term and a new ADR as `.md`, an edit to the backend's legacy CONTEXT.md as a `.patch`. The dev running `/fk-ticket` applies them to their own checkout (`git apply` the patch, drop the ADR files into `docs/adr/`). Do not assume these files exist locally for whoever picks this up — the PO's checkout is not the dev's checkout."*
  - *Open Questions*
- **Labels**: add `po-drafted` so devs know this came from the PO flow and may need refinement before estimation
- **Priority**: ask the PO if you don't already know

**Do not create sub-tasks.** Sub-tasks are an implementation concern — a dev creates them when they pick up the ticket via `/fk-ticket`.

**Do not create a Confluence page automatically.** If the spec is large and the PO wants a Confluence companion page, ask first: "Deze spec is behoorlijk uitgebreid — wil je dat ik 'm ook als Confluence-pagina aanmaak?" Only proceed if they say yes.

### Attach design assets

The Atlassian MCP tools currently do not expose an attachment upload, so attaching files to the new issue is done via a bash helper that calls the Jira REST API directly.

If you collected one or more uploaded file paths in Phase 4:

1. Confirm with the PO before uploading: "Ik heb [N] screenshot(s) in de chat gezien — zal ik ze als bijlage aan het ticket hangen?" Wait for a yes.
2. The helper lives at `scripts/attach-to-jira.sh` next to this SKILL.md file. Resolve its absolute path from the SKILL.md location you were loaded from — when installed via the marketplace it lands under `~/.claude/plugins/cache/<marketplace>/fk-po/<version>/skills/fk-po-ticket/scripts/attach-to-jira.sh`, where `<version>` is a git commit sha and changes on every marketplace update, so resolve it rather than remembering it; when running from the dev workspace it's `cowork-plugins/fk-po/skills/fk-po-ticket/scripts/attach-to-jira.sh` under the user's FlowKeeper folder. Invoke it with the resolved absolute path:

   ```sh
   bash <absolute-path-to-script> FK-512 \
     "/path/to/uploaded/screenshot-1.png" \
     "/path/to/uploaded/screenshot-2.png"
   ```

3. The script reads credentials from `~/FlowKeeper/.fk-po/jira.env` (which the PO sets up once per `setup-jira-attachments.md` next to this SKILL.md). On success it prints `ok <filename>` per file. On failure it prints the HTTP code and a snippet of the response body.

**If the helper says `No Jira credentials config found.`**, the PO hasn't done the one-time setup. Don't try to work around it — tell her plainly: "Voor attachments moet je eenmalig een Atlassian API token instellen. Volg `setup-jira-attachments.md` in de skill-map (kost 2 minuten)." Then continue without attachments and mention in Phase 7 which files were not uploaded.

**Use absolute paths.** Uploaded files in Cowork have absolute paths in the system context — pass those verbatim. Don't try to copy or symlink them.

### Attach documentation changes

If you wrote a glossary term or an ADR during this session, attach it so it travels with the ticket. **The PO's local checkout is not the dev's checkout** — a dev who picks the ticket up on another machine will not have these uncommitted local files, so the content must live on the ticket (inline in the description, plus the exact files attached here).

1. **New glossary terms and new ADRs are untracked files, so they do NOT appear in `git diff` — attach the `.md` file verbatim.** This is the normal case now that a term is its own file under `docs/context/`. Do not try to produce a patch for a file git has never seen: `git diff` prints nothing and you would attach an empty patch.

2. Only for a term you *edited* that still lives in the backend's legacy `CONTEXT.md` do you need a patch — that file is tracked, so a read-only diff works (this stages, commits and pushes nothing):

   ```sh
   git -C <repo-path> diff -- CONTEXT.md > /tmp/FK-XXX-<repo>-context.patch
   ```

3. Attach the file(s) with the same helper used for designs (resolve its absolute path as in "Attach design assets"):

   ```sh
   bash <absolute-path-to-script> FK-XXX \
     "<repo-path>/frontend-application/docs/context/cancellation-window.md" \
     "<repo-path>/frontend-application/docs/adr/0003-....md"
   ```

4. On the dev side each attached `.md` is dropped into the matching directory (`docs/context/` or `docs/adr/`); a `*-context.patch`, if there is one, is applied with `git apply`. The dev-side `/fk-ticket` skill should pull these attachments rather than assume local uncommitted changes.

**If the attach helper says `No Jira credentials config found.`**, do not work around it — the inline content in the description is still complete. Note in Phase 7 which files were not attached, and that the dev recreates them from the inline text in the description.

## Phase 7: Confirm and hand off

Tell the PO in their conversation language:

> "Klaar! De ticket staat in Jira: [FK-### with URL]. Ik heb [N] design assets meegestuurd en de label `po-drafted` toegevoegd. Een dev kan 'm oppakken met `/fk-ticket FK-###` in Claude Code."

If glossary or ADR files were written during the session, list them explicitly so the PO knows what landed on disk:

> "Tijdens het grillen heb ik de volgende docs bijgewerkt:
> - `backend-application/docs/context/cancellation-window.md` — term 'Cancellation Window' toegevoegd
> - `backend-application/docs/adr/0003-edit-lock-after-invoicing.md` — nieuwe ADR
>
> De inhoud staat in het ticket zelf én als bijlage (nieuwe term en nieuwe ADR's als `.md`, een wijziging in de oude backend-CONTEXT.md als `.patch`), dus de dev kan ze toepassen ongeacht op welke machine hij werkt. Op jouw checkout staan ze ook nog als lokale wijziging — laat ze staan of gooi ze weg, de dev werkt vanaf het ticket. Geen actie van jou nodig."

If anything was deferred (e.g. priority not set, design promised later, attachment setup not yet done so files weren't uploaded), remind the PO of the open items in their language.

## Hard constraints on the spec and ticket

- **English in the ticket, full stop.** Even if the PO insists on Dutch, explain once that the spec is for an international team and produce it in English. If they still insist after that, comply — but flag in the description that this conflicts with the team language convention.
- **English in the glossary and ADRs, full stop.** Same reasoning — these are team artifacts. The Dutch grilling conversation is the scratchpad; what lands in the docs is English.
- **No implementation details in the ticket.** No file paths, function names, class names, module names, or framework references. No "use a queue", "add a service", "refactor X". The dev team decides the technical approach during `/fk-ticket`.
- **No code, no pseudocode, no data schemas.** If you catch yourself heading there, stop and rephrase as a question for the PO instead.
- **Code findings inform grilling questions, not the ticket body.** What you read in the repo helps you ask better questions — its content does not appear as prose in the Jira ticket. The only persistent artifacts of code exploration are (a) glossary and ADR file writes on disk, and (b) the content of those writes carried into the ticket's "Documentation updates" section (inline text plus the attached `.patch` / ADR `.md` files).
- **Never *write* git state.** Do not run `git add`, `git commit`, `git push`, `git checkout`, or any branch operations. Read-only inspection IS allowed: `git status` (stale-doc check) and `git diff` (to produce the doc patch attached to the ticket in Phase 6). Glossary and ADR writes are plain file writes; the dev who picks up the ticket via `/fk-ticket` is responsible for committing them. If the PO explicitly asks "wil je dit committen?", explain once that this skill leaves git state to a developer on purpose, then continue.
- **Warn on stale doc changes.** At the start of a session, if local reads are being used, do a quick `git status` check (read-only — no modifications). If there are pre-existing uncommitted changes under `docs/context/` or `docs/adr/` from a previous PO session, surface them: "Je hebt nog wat openstaande doc-wijzigingen van een vorige sessie staan — moet ik ze laten staan of moet een dev ze eerst oppakken voordat we beginnen?" Don't proceed silently on top of them.

## When the PO wants to wrap up early

If the PO says something like "geef me het ticket maar", "we hebben genoeg", or "round up now" before you've covered everything, produce the spec with what you have and put unresolved items explicitly under **Open Questions**. Don't refuse, but don't pretend you've covered ground you haven't either. Devs reading the ticket will see the gaps and can come back with questions.

## What this skill does not do

- It does not write implementation tickets with technical detail. That's `/fk-ticket` in Claude Code, which a dev runs after the PO ticket exists.
- It does not break work into sub-tasks. Sub-tasks are a refinement/implementation concern.
- It does not perform code review or QA on existing code. It uses the codebase only as a source of grounding for spec questions.
- It does not estimate effort or set deadlines. Those come during refinement with the dev team.

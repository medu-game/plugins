---
name: fk-release-notes
description: 'Draft a release note (EN+NL items, grouped New/Improved/Fixed) from the Jira tickets shipped since the last published release note. Read-only: the product owner reviews the draft and pastes it into the admin panel''s Release notes form, then publishes manually — this skill never writes to the panel, Jira, or the repos. Use in Cowork when the PO wants to prepare release-note content. Triggers on phrases like "maak release notes", "release notes opstellen", "release notes schrijven", "wat is er sinds de vorige release uitgegaan", "release notes sinds <datum/versie>", "draft release notes", "what shipped since the last release". Conversation runs in the user''s language (typically Dutch); the release-note copy itself is written natively in both EN and NL.'
---

Draft a release note from shipped Jira tickets. The output is a **draft** the product owner
copy-pastes into the admin panel's Release notes form and publishes manually after review.
This skill never writes to the panel, Jira, or the repos.

## Environment contract (Cowork-compatible)

This skill must run identically in Claude Code and Claude Cowork. Therefore:

- Jira and Bitbucket access goes **exclusively through the Atlassian MCP connector** under the
  operator's own login. The exact tool names vary by environment; use the connector's
  Jira-search and Bitbucket-pull-request operations. Never use stored tokens or direct REST calls.
- Do NOT use Docker, `.bash/` scripts, the dev-stack lock, `/screenshots`, or any other
  sandbox-only helper.
- Do NOT assume `backend-application/` or `frontend-application/` are cloned. If they happen
  to be present you may use local `git log`/`git show` as a faster path, but the Atlassian MCP
  path is the contract.
- If the Atlassian MCP tools are unavailable, tell the operator to connect the Atlassian
  tool for this session and stop.

## Step 1: Determine the window

The operator may give a date (`2026-06-18`) or the previous release-note version (`0.9.5`) up
front — in Cowork just say it in chat, in Claude Code it arrives as `$ARGUMENTS`.

- Date given → that is `<since>`.
- Version given, or nothing given → ask the operator:
  "What is the publish date (and version) of the last published release note? You can see it
  in the admin panel under Release notes."
- Also record the previous version string; you need it to suggest the next one.

## Step 2: Collect shipped tickets

Query Jira via the Atlassian MCP (Jira JQL search, paginate until the last page):

```
project = FK AND status = "Deployed to PROD"
AND status CHANGED TO "Deployed to PROD" AFTER "<since>"
ORDER BY updated ASC
```

Fields: `summary`, `issuetype`, `labels`, `components` — deliberately WITHOUT `description`;
a two-month window returns 80+ tickets and descriptions blow past the tool-result size limit.
Fetch descriptions later (Step 4) in one batched `key in (FK-…, FK-…)` query, only for the
tickets whose summary alone does not make the user-visible change clear.

If the result is empty: report "No tickets were deployed to PROD since <since>" and stop.

## Step 3: Triage

Split the tickets into three buckets:

1. **Included** — changes an end-user can notice in the app.
2. **Skipped** — internal-only work: ai-harness/lanes/preview/CI/tooling tickets, admin-panel
   internals (operators are not end-users), pure refactors, test-only or docs-only changes,
   developer experience, tickets titled as temporary tests. Record a one-line reason per
   skipped ticket.
3. **Needs PO decision** — genuinely ambiguous. Never guess; list these for the operator.
   Typical case: an old ticket batch-transitioned to Deployed to PROD long after it actually
   shipped — it matches the JQL but probably predates the previous release note.

Fold **subtasks into their parent**: one item covers the parent story; list the subtask keys
in that item's source column, not as separate items or skips.

## Step 4: Gather source material per included ticket

The ticket text alone regularly drifts from what actually shipped, so verify against the code:

- Find the ticket's merged PR(s) via the Atlassian MCP Bitbucket pull-request tool (workspace
  `flowkeeper`, repos `backend-application` and `frontend-application`):
  list merged PRs matching `title ~ "FK-###"`, small page size (responses are verbose). If the
  title match comes up empty, retry with `source.branch.name ~ "FK-###"`.
- Read the PR description and file list; only open the full diff when the ticket text leaves
  the user-visible behaviour unclear.
- If no PR is found, use the ticket text only and mark the item as lower-confidence in the
  review column.
- If the ticket links a Claude Design project and the DesignSync tool is available, reuse the
  design's screen and button names so the copy matches what users literally see. This is
  optional enrichment — skip silently when unavailable.

## Step 5: Write the items

Each panel item has four copy fields: a short **title** (EN + NL) and a longer **description**
(EN + NL). Title is required on the panel's create form; description is optional but you should
write one for every item. So produce all four per item:

- **Title (`title_en` / `title_nl`)**: a short headline naming the feature — a few words, no
  trailing period (e.g. `Absence wizard` / `Afwezigheidswizard`).
- **Description (`text_en` / `text_nl`)**: one short sentence of detail — what the user can now
  do or what changed. This is the descriptive line the earlier version of this skill emitted.
- One user-visible change per item; merge small related tickets into one item.
- End-user language: no jargon, no class or endpoint names, no ticket keys in any of the copy.
- Write EN and NL both natively — the Dutch must read naturally, never as a literal translation.
- No em-dashes in the copy (use a comma, period, or colon).
- Classify each item as exactly one of `new`, `improved`, `fix`.
- Order the items New → Improved → Fixed.

## Step 6: Output

Produce the draft in chat AND write the identical content to `RELEASE-NOTES-DRAFT.md` in the
workspace root (scratch file — never commit it):

1. **Suggested version**: the last published version with a bump (minor when there are `new`
   items, patch otherwise). Base it on the actual latest published version the operator gave in
   Step 1 — do not assume a starting point. Mark it clearly as a suggestion the operator can
   override.
2. **Items table**: `type | title_en | title_nl | text_en | text_nl | source` — the source
   column lists the ticket key(s) and any lower-confidence flag; it is for review only and is
   not pasted into the panel.
3. **Skipped tickets**: key + one-line reason each, so the PO can veto a wrong exclusion.
4. **Needs PO decision**: the ambiguous tickets with the open question per ticket.

Close with: the PO pastes the version and items into Panel ▸ Content ▸ Release notes ▸ Create.
Per item the panel form has **Type**, **Title (EN)** and **Title (NL)** (both required on
create), and **Description (EN)** and **Description (NL)** (optional) — these map to
`type` / `title_en` / `title_nl` / `text_en` / `text_nl` respectively. The PO reviews and
publishes there; nothing is auto-published.

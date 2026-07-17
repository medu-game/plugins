# CONTEXT.md format

Adapted from Matt Pocock's [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/CONTEXT-FORMAT.md)
skill (MIT) for the FlowKeeper PO workflow.

The `CONTEXT.md` files in `backend-application/` and `frontend-application/`
are the product glossary. They define the canonical English terms the team
uses for FlowKeeper's domain so devs, PO, and code all speak the same
language. Written in English regardless of the chat language.

The example terms below (Project, Phase, Project Lead, Cancellation Window,
etc.) are **illustrative only** — they show the shape of a healthy entry
and the kind of distinctions worth canonicalising. They are not pre-seeded
FlowKeeper terminology. Whatever lands in the real `CONTEXT.md` files
emerges from actual grilling sessions, not from this template.

## Structure

```
# {Context name — e.g. Backend, Frontend, or a specific domain}

{One or two sentences describing what this context is and why it exists.}

## Language

**Project**:
A planning unit owned by a project lead, containing one or more phases.
_Avoid_: Job, assignment, case

**Phase**:
A time-boxed slice of a Project with its own deliverables and budget.
_Avoid_: Stage, milestone, sprint

**Project Lead**:
The user responsible for a Project's planning and budget.
_Avoid_: Owner, manager, supervisor

## Relationships

- A **Project** has one or more **Phases**
- A **Project** has exactly one **Project Lead**
- A **Phase** has its own budget, independent of the Project's total budget

## Example dialogue

> **PO:** "When a **Project Lead** archives a **Project**, what happens to its
> active **Phases**?"
> **Dev:** "All **Phases** become read-only — they're preserved for reporting
> but cannot accept new time entries."

## Flagged ambiguities

- "Owner" was used to mean both **Project Lead** and the company that owns the
  tenant — resolved: **Project Lead** for the role inside FlowKeeper, "tenant
  owner" for the billing-level concept.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the
  best one and list the others as aliases under `_Avoid_`.
- **Flag conflicts explicitly.** If a term has been used ambiguously, call it
  out under "Flagged ambiguities" with the resolution.
- **Keep definitions tight.** One sentence max. Define what something IS, not
  what it does.
- **Show relationships.** Use bold term names and express cardinality where
  obvious.
- **Domain terms only.** General programming concepts (cache, queue, retry) do
  not belong here even if FlowKeeper uses them heavily. Before adding a term,
  ask: is this specific to FlowKeeper's product domain, or general
  software? Only the former belongs.
- **Group under subheadings** when natural clusters emerge (e.g.
  `### Planning`, `### Time tracking`). A flat list is fine when the glossary
  is small.
- **Write an example dialogue.** A short PO–dev exchange that shows how the
  terms hang together. This catches sloppy edges that bullet definitions
  hide.
- **English, always.** Even though the grilling conversation may run in
  Dutch, the glossary is a team artifact and stays in English. Use the
  English term as the canonical entry; mention Dutch only as an alias under
  `_Avoid_` if the PO frequently reaches for a Dutch word that needs
  redirecting.

## FlowKeeper layout — two contexts

FlowKeeper has two repos with overlapping but distinct domain language —
backend models the data, frontend models user-visible behaviour. Treat them
as two contexts:

```
~/FlowKeeper/
├── backend-application/
│   ├── CONTEXT.md
│   └── docs/adr/
│       ├── 0001-event-sourced-timesheet.md
│       └── 0002-postgres-row-level-tenancy.md
└── frontend-application/
    ├── CONTEXT.md
    └── docs/adr/
        └── 0001-tanstack-query-cache-keys.md
```

There is no top-level `CONTEXT-MAP.md` — the two repos live side by side at
`~/FlowKeeper/` and each has its own glossary. Many terms appear in both
glossaries because they cross the API boundary; that is fine. When the
backend and frontend definitions disagree, that is a real bug — surface it
during grilling.

Decide where a term lands by asking: is this primarily about how data is
modelled and persisted (backend), or about user-visible behaviour and
screens (frontend)? If both, write it in both glossaries with consistent
wording.

## Lazy creation

Do not create `CONTEXT.md` at the start of a session "just in case". Only
create it the first time a term is canonicalised during grilling. Same for
`docs/adr/` — create the directory when the first ADR is being written.

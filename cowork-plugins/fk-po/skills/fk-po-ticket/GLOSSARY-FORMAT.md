# Glossary format

Adapted from Matt Pocock's [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/CONTEXT-FORMAT.md)
skill (MIT) for the FlowKeeper PO workflow.

The glossary is the canonical English vocabulary for FlowKeeper's domain, so
devs, PO and code all speak the same language. It is written in English
regardless of the chat language.

**One term, one file: `<repo>/docs/context/<term-lowercased-hyphenated>.md`.**
That is the whole point of the layout. The glossary used to be a single
`CONTEXT.md` per repo that every ticket appended to, which made it the single
most frequent merge conflict in both repos (FK-678). A new file cannot conflict
with anything.

## The shape of one file

```markdown
## Client Number

The identifier a company uses for a Client in its own administration. Optional,
a Client can be created and imported without one, and an existing number can be
cleared again. Accepts letters, digits and hyphens, up to 12 characters
(e.g. 3566-OH). Canonical NL label: "Klantnummer".
_Avoid_: customer number, client code, klantnr.
```

- The `## Term` heading is the **first line**, so the files still read as one
  glossary when concatenated.
- The definition is a tight paragraph, not an essay. Longer than one sentence is
  fine and usual, because a good entry carries the PO decisions that go with the
  term: what is optional, what the canonical Dutch label is, which edge case was
  settled and by whom.
- `_Avoid_:` closes the file with the aliases this term replaces, Dutch ones
  included.

## Rules

- **Be opinionated.** When several words exist for one concept, pick the best
  one and list the rest under `_Avoid_`.
- **A disagreement between the two repos is a real bug.** Many terms appear in
  both glossaries because they cross the API boundary, which is fine. Two
  different definitions of the same term is not. Surface it during grilling.
- **Domain terms only.** General programming concepts (cache, queue, retry) do
  not belong here even if FlowKeeper uses them heavily. Ask: is this specific to
  FlowKeeper's product domain, or is it general software? Only the former.
- **English, always.** The grilling conversation may run in Dutch; the glossary
  is a team artifact and stays in English. Use the English term as the canonical
  entry and mention a Dutch word only as an alias under `_Avoid_`, when the PO
  keeps reaching for it.
- **Never append to `CONTEXT.md`.** The frontend no longer has that file at all
  (FK-680). The backend still carries the terms written before the split, and
  they move to `docs/context/` once the pull requests touching that file have
  merged. Read it while it is there; write only new files.

## Which repo does a term belong in

Ask: is this primarily about how data is modelled and persisted (backend), or
about user-visible behaviour and screens (frontend)? If it is genuinely both,
write it in both with consistent wording.

```
~/FlowKeeper/
├── backend-application/
│   ├── CONTEXT.md            <- legacy, read-only, being emptied
│   └── docs/
│       ├── context/
│       │   ├── README.md
│       │   └── invited-user.md
│       └── adr/
│           └── 0001-event-sourced-timesheet.md
└── frontend-application/
    └── docs/
        ├── context/
        │   ├── README.md
        │   ├── client-number.md
        │   └── flow.md
        └── adr/
            └── 0001-tanstack-query-cache-keys.md
```

Each repo's `docs/context/README.md` restates the naming rule and the measured
reason the directory exists. There is no top-level map; the two repos sit side
by side at `~/FlowKeeper/` and each owns its own glossary.

## Lazy creation

Write a term file the first time a term is canonicalised during grilling, never
at the start of a session "just in case". Same for `docs/adr/`: create the
directory when the first ADR is written.

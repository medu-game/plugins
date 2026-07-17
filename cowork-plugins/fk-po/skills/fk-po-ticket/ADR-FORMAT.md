# ADR format

Adapted from Matt Pocock's [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/ADR-FORMAT.md)
skill (MIT) for the FlowKeeper PO workflow.

Architecture Decision Records live in `docs/adr/` inside each FlowKeeper
repo (`backend-application/docs/adr/`, `frontend-application/docs/adr/`)
and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

## Template

```
# {Short title of the decision}

{1–3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording
*that* a decision was made and *why*, not in filling boilerplate sections.

## Optional sections

Only include these when they add real value. Most ADRs will not need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions get revisited
- **Considered options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` in the relevant repo for the highest existing number and
increment by one. If the directory doesn't exist yet, create it and start
at `0001`. Numbering is per-repo, not shared across the two repos.

## When to offer an ADR during a PO grilling session

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code or feature and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one was picked for specific reasons

If any of the three is missing, skip the ADR.

A PO grilling session will only rarely surface an ADR-worthy decision. ADRs
are mostly about technical shape (data model, integration pattern,
technology lock-in). When a PO discussion does produce one, it is usually
about **product boundaries** — the things that constrain how the product
gets built for a non-technical reason.

### What qualifies in a PO context

- **Product boundary and scope decisions.** "Time entries cannot be edited
  after invoicing." The explicit no-s are as valuable as the yes-s.
- **Constraints not visible in the code.** "We cannot store data outside
  the EU because of contractual obligations to our biggest customer."
  "Response times must stay under 2s for the planning view because that's
  what the design partner committed to."
- **Deliberate deviations from the obvious feature path.** "We're keeping
  manual approval for time-entry edits even though it slows things down,
  because audit requirements outweigh ergonomics." Anything a future
  reader would otherwise try to "fix" without understanding the reason.
- **Domain rules that look weird until you know the history.** "A Project
  always has at least one Phase, even when the customer says they don't
  need phases — we tried optional phases in 2024 and it broke reporting."

### What does not belong

- Implementation details (database choice, framework, library). Those are
  dev decisions, not PO decisions.
- Anything that's easy to reverse (UI copy, button placement, feature
  flags). If it can be flipped in a sprint, it doesn't need an ADR.
- Decisions where there were no real alternatives. "We use English in the
  UI" is not an ADR if English was always going to win.

## Language

ADRs are written in English. The team is international and these documents
are the lasting record of "why we did it this way". A Dutch ADR is unusable
for half the team.

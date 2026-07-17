# FlowKeeper plugins for Claude

Plugins and skills for [Claude Cowork](https://claude.ai) and Claude Code,
maintained by the FlowKeeper team.

This repository is a **public distribution mirror**. The plugins are authored in
FlowKeeper's internal tooling repo and published here so the team can install and
update them through Claude's plugin marketplace, which can read a public git repo
without authentication.

## What's here

- **`fk-po`** — product-owner tooling. Four skills covering the
  explore → brainstorm → ticket flow, plus release-note drafting:
    - `fk-po-explore` — read-only. Explains how an existing feature works in
      plain product language.
    - `fk-po-brainstorm` — pre-ticket grilling loop for fuzzy ideas. Pure
      conversation; produces no spec or ticket.
    - `fk-po-ticket` — grills an idea into a structured Jira ticket, with
      screenshot attachments.
    - `fk-release-notes` — read-only. Drafts EN+NL release-note items from
      shipped Jira tickets for a human to review and publish.

  The ticket and brainstorm flows are docs-aware: they grow a product glossary
  (`CONTEXT.md`) and a decision log (`docs/adr/`) inline.

## Install in Claude Cowork

1. Open **Cowork → Customize → Plugins → Add marketplace**.
2. Paste this repository's URL:
   ```
   https://github.com/medu-game/plugins
   ```
3. Install **`fk-po`** from the marketplace, then enable its skills.

To update later, use the marketplace's **Update** action.

## Install in Claude Code (CLI)

```sh
claude plugin marketplace add medu-game/plugins
claude plugin install fk-po@flowkeeper
```

Update with:

```sh
claude plugin marketplace update flowkeeper
```

## Skill setup

`fk-po-ticket` can attach screenshots to Jira. That requires a per-user
Atlassian API token; see
[`cowork-plugins/fk-po/skills/fk-po-ticket/setup-jira-attachments.md`](cowork-plugins/fk-po/skills/fk-po-ticket/setup-jira-attachments.md).
The other three skills need no extra setup beyond an Atlassian connector.

## License

MIT — see [`LICENSE`](LICENSE). The grilling and exploration skills adapt
[Matt Pocock's skills](https://github.com/mattpocock/skills) (MIT); each
`SKILL.md` cites the specific upstream it borrows from.

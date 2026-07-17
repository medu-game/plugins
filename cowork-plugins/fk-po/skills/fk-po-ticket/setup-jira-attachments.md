# Setting up Jira attachment uploads

The `fk-po-ticket` skill can attach screenshots that the PO pastes into the
Cowork chat directly to the Jira ticket it creates. This needs a one-time
setup: a personal Atlassian API token, stored in a small config file on the
PO's Mac.

This setup is **per-user** — every PO who wants attachment uploads does this
once on her own machine. The token is separate from the OAuth connection the
Atlassian connector in Cowork uses, because that token isn't exposed to
scripts.

## Step 1 — Allow Cowork to reach `api.atlassian.com` (admin, one-time per org)

The skill talks to Jira via the central `https://api.atlassian.com/ex/jira/...`
endpoint. Cowork's network egress is allowlist-based, so this host must be
explicitly allowed under **`claude.ai → Admin → Capabilities → Network
access`**:

```
api.atlassian.com
flowkeeper.atlassian.net   (already allowed for the rest of the harness)
```

Save the change. Without `api.atlassian.com` on the allowlist every attempt to
attach will fail with `HTTP 403 from proxy`. This is an org-wide setting, not
per-user — once it's there, all POs benefit.

## Step 2 — Mint a scoped Atlassian API token

Click this auto-fill link while signed in with your `@flowkeeper.nl` account:

```
https://id.atlassian.com/manage-profile/security/api-tokens?autofillToken&expiryDays=max&appId=mcp&selectedScopes=all
```

The query string pre-selects the right scopes (Rovo MCP scopes, which also
cover Jira read/write through `api.atlassian.com`) and sets the maximum
expiry. Just:

1. Name the token recognisably, e.g. `fk-po-ticket`.
2. Click **Create**.
3. Copy the token — Atlassian only shows it once.

The token grants the same effective access to Jira/Confluence/Bitbucket as
your account does. Treat it like a password.

> Why this token type? It's the same token type the FlowKeeper sandbox uses
> for the dev workflow — one token format org-wide, one rotation cycle. The
> previous "Create API token (classic)" flow is no longer needed.

## Step 3 — Store the token on your Mac

Open **Terminal** and run, replacing the email and token with your own:

```sh
mkdir -p ~/FlowKeeper/.fk-po
cat > ~/FlowKeeper/.fk-po/jira.env <<'CONF'
JIRA_EMAIL=you@flowkeeper.nl
JIRA_API_TOKEN=<paste-the-token-from-step-2>
CONF
chmod 600 ~/FlowKeeper/.fk-po/jira.env
```

`chmod 600` makes the file readable only by you. Don't skip it.

> Why a file in `~/FlowKeeper/`? That folder is mounted into Cowork's sandbox
> when you select it as your working folder, so the skill can read the
> credentials from inside Cowork. Files at the top of `~/FlowKeeper/` outside
> of the `backend-application/` and `frontend-application/` clones are not
> part of either git repo and won't end up in a commit.

## Step 4 — Verify

Still in Terminal, from inside `~/FlowKeeper/`:

```sh
bash cowork-plugins/fk-po/skills/fk-po-ticket/scripts/attach-to-jira.sh \
  FK-1 /path/to/any-image.png
```

(Replace `FK-1` with a real issue key you have access to, and the path with
any file on your Mac.)

You should see `ok <filename> (HTTP 200)` and the file should appear in the
Attachments section of that Jira issue. If you see a different HTTP code,
check the response shown below the error — see Troubleshooting below.

## Step 5 — Done

From now on, when you use `fk-po-ticket` in Cowork and paste screenshots into
the chat, the skill will offer to attach them automatically to the ticket it
creates.

## Rotating or revoking the token

- **Revoke:** open <https://id.atlassian.com/manage-profile/security/api-tokens>
  and click the trash icon next to the token labelled `fk-po-ticket`.
- **Rotate:** mint a new token via the same auto-fill URL as step 2, then
  overwrite the `JIRA_API_TOKEN` line in `~/FlowKeeper/.fk-po/jira.env`.

Atlassian emails you ~7 days before expiry. Don't ignore that mail — a dead
token in the middle of a ticket flow shows up as `HTTP 401` and is annoying
to debug from cold.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `No Jira credentials available.` | The config file isn't where the script looks. Check the path and run `ls -la ~/FlowKeeper/.fk-po/`. |
| `HTTP 401` | Token wrong, expired, or revoked — or the e-mail in `jira.env` doesn't match the account the token was minted on. Mint a new one in step 2. |
| `HTTP 403` | Token alive but the account lacks permission to attach to that issue. Check your Jira permissions. |
| `HTTP 403 from proxy` | `api.atlassian.com` not on Cowork's network allowlist. Step 1 not done yet, or the admin save didn't propagate — try again. |
| `HTTP 404` | Issue key doesn't exist, or you minted a token via the classic "Create API token" button instead of the scoped auto-fill URL — classic tokens don't reach the `api.atlassian.com` endpoint this script uses. Revoke and re-mint via the link in step 2. |
| `HTTP 413` | File is too big. Atlassian Cloud caps attachments at ~250 MB; screenshots are fine, multi-GB recordings won't be. |

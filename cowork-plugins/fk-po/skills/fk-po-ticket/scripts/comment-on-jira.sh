#!/usr/bin/env bash
# Post a comment to a Jira issue via the REST API.
#
# Usage:
#   comment-on-jira.sh <ISSUE_KEY>           # body read from stdin
#   echo "hello" | comment-on-jira.sh FK-123
#
# Credentials are resolved the same way as attach-to-jira.sh:
#   1. $ATLASSIAN_BASIC_AUTH env var (base64(email:token))
#   2. $FK_PO_JIRA_CONFIG               (env override pointing at a config file)
#   3. /sessions/*/mnt/FlowKeeper/.fk-po/jira.env   (Cowork sandbox view)
#   4. /workspace/.fk-po/jira.env                   (FlowKeeper sandbox bind-mount)
#   5. $HOME/FlowKeeper/.fk-po/jira.env             (run directly on macOS host)
# See attach-to-jira.sh for the config file format.
#
# The body is plain text. It is wrapped into a minimal ADF doc so the
# /rest/api/3 endpoint accepts it. Newlines in the body produce extra
# paragraphs.
#
# Exit codes:
#   0  comment posted
#   1  bad arguments
#   2  config not found or incomplete
#   3  upload failed

set -euo pipefail

usage() {
  echo "Usage: $0 <ISSUE_KEY>   (comment body on stdin)" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

ISSUE_KEY="$1"

# --- Resolve auth ------------------------------------------------------------
# Always route via api.atlassian.com/ex/jira/{cloudId}; just build the
# Authorization header from whichever credential source is available. See
# attach-to-jira.sh for the longer rationale.
FLOWKEEPER_CLOUD_ID_DEFAULT="85a2ac39-2758-4fd3-92a0-1d70f90b1eb0"
JIRA_CLOUD_ID="${JIRA_CLOUD_ID:-$FLOWKEEPER_CLOUD_ID_DEFAULT}"
JIRA_API_URL="https://api.atlassian.com/ex/jira/${JIRA_CLOUD_ID}"

CURL_AUTH_ARGS=()

if [ -n "${ATLASSIAN_BASIC_AUTH:-}" ]; then
  CURL_AUTH_ARGS=(-H "Authorization: Basic ${ATLASSIAN_BASIC_AUTH}")
else
  CONFIG=""
  if [ -n "${FK_PO_JIRA_CONFIG:-}" ] && [ -f "${FK_PO_JIRA_CONFIG}" ]; then
    CONFIG="${FK_PO_JIRA_CONFIG}"
  else
    for candidate in /sessions/*/mnt/FlowKeeper/.fk-po/jira.env \
                     /workspace/.fk-po/jira.env \
                     "${HOME:-/root}/FlowKeeper/.fk-po/jira.env"; do
      if [ -f "$candidate" ]; then
        CONFIG="$candidate"
        break
      fi
    done
  fi

  if [ -z "$CONFIG" ]; then
    cat >&2 <<'EOF'
No Jira credentials available.

Easiest in the FlowKeeper sandbox: ATLASSIAN_BASIC_AUTH is already exported
by fk() from the macOS keychain. Otherwise set up ~/FlowKeeper/.fk-po/jira.env
— see setup-jira-attachments.md next to this script for the walkthrough.
EOF
    exit 2
  fi

  # shellcheck disable=SC1090
  . "$CONFIG"

  if [ -z "${JIRA_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
    echo "Config at $CONFIG is missing JIRA_EMAIL or JIRA_API_TOKEN." >&2
    exit 2
  fi
  CURL_AUTH_ARGS=(-u "$JIRA_EMAIL:$JIRA_API_TOKEN")
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (used to build the ADF payload safely)." >&2
  exit 2
fi

# --- Read body and build ADF payload -----------------------------------------
BODY="$(cat)"
if [ -z "$BODY" ]; then
  echo "Empty comment body — nothing to post." >&2
  exit 1
fi

# Split the body on blank lines (one ADF paragraph per chunk). This keeps
# multi-paragraph comments readable in Jira instead of one long wall.
#
# `[~accountid:UUID]` patterns are converted into proper ADF mention nodes —
# Jira's ADF API does not auto-detect bracketed-text mentions inside a plain
# `text` node; without an explicit `{type: "mention", attrs: {id: ...}}` node
# the user is never notified (the text just shows up as literal). Wiki-markup
# style `[~accountid:UUID]` in plain-text comments only works when Jira's UI
# happens to post-process the line, which is unreliable through the REST API.
PAYLOAD="$(printf '%s' "$BODY" | jq -Rs '
  # Split a paragraph string into a sequence of ADF inline nodes,
  # turning every [~accountid:UUID] into a proper mention node.
  def to_inlines:
    gsub("\\[~accountid:(?<id>[A-Za-z0-9:_-]+)\\]"; "\(.id)")
    | split("")
    | [ range(0; length) as $i
        | { idx: $i, val: .[$i] } ]
    | map(
        if (.idx % 2 == 1)
        then { type: "mention", attrs: { id: .val, text: "" } }
        else { type: "text", text: .val }
        end
      )
    | map(select(.type == "mention" or (.text | length) > 0));
  . as $raw
  | ($raw | split("\n\n"))
  | map(select(length > 0))
  | {
      body: {
        type: "doc",
        version: 1,
        content: map({
          type: "paragraph",
          content: to_inlines
        })
      }
    }
')"

# --- POST --------------------------------------------------------------------
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

set +e
HTTP_CODE="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' \
  -X POST \
  "${CURL_AUTH_ARGS[@]}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data "$PAYLOAD" \
  "$JIRA_API_URL/rest/api/3/issue/$ISSUE_KEY/comment")"
set -e

case "$HTTP_CODE" in
  [0-9][0-9][0-9]) : ;;
  *) HTTP_CODE="000" ;;
esac

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "ok   commented on ${ISSUE_KEY}  (HTTP ${HTTP_CODE})"
  exit 0
fi

echo "FAIL commenting on ${ISSUE_KEY}  (HTTP ${HTTP_CODE})" >&2
echo "     response: $(head -c 500 "$TMP_BODY")" >&2
exit 3

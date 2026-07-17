#!/usr/bin/env bash
# Attach one or more local files to a Jira issue via the central REST endpoint
# at api.atlassian.com.
#
# Usage:
#   attach-to-jira.sh <ISSUE_KEY> <file1> [file2 ...]
#
# This script always routes via the central
# https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/... endpoint, which
# accepts both:
#   - Rovo MCP-scoped Atlassian API tokens (via $ATLASSIAN_BASIC_AUTH)
#   - Classic Atlassian API tokens (via JIRA_EMAIL + JIRA_API_TOKEN in jira.env)
# The tenant-specific {tenant}.atlassian.net/rest/... URL is deliberately not
# used: it rejects Rovo-scoped tokens, so a single endpoint keeps both auth
# paths working with one code path.
#
# Credentials are resolved in this order:
#   1. $ATLASSIAN_BASIC_AUTH env var (base64("email:token"), sent as
#      `Authorization: Basic ...`). Set automatically by fk() in the
#      FlowKeeper sandbox from the macOS keychain. Skips file lookup
#      entirely when present.
#   2. $FK_PO_JIRA_CONFIG               (env override pointing at a config file)
#   3. /sessions/*/mnt/FlowKeeper/.fk-po/jira.env   (Cowork sandbox view)
#   4. /workspace/.fk-po/jira.env                   (FlowKeeper sandbox bind-mount)
#   5. $HOME/FlowKeeper/.fk-po/jira.env             (run directly on macOS host)
#
# The config file must be shell-sourceable and define:
#   JIRA_EMAIL=you@flowkeeper.nl
#   JIRA_API_TOKEN=<token from id.atlassian.com>
#
# Override the FlowKeeper cloud ID via $JIRA_CLOUD_ID if running against a
# different Atlassian tenant.
#
# Exit codes:
#   0  all files uploaded
#   1  bad arguments
#   2  config not found or incomplete
#   3  at least one upload failed

set -euo pipefail

usage() {
  echo "Usage: $0 <ISSUE_KEY> <file1> [file2 ...]" >&2
}

if [ "$#" -lt 2 ]; then
  usage
  exit 1
fi

ISSUE_KEY="$1"
shift

# --- Resolve auth ------------------------------------------------------------
# Always route via api.atlassian.com/ex/jira/{cloudId}; just build the
# Authorization header from whichever credential source is available.
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
      # The /sessions/*/ glob may not expand if no sandbox match exists; guard with -f.
      if [ -f "$candidate" ]; then
        CONFIG="$candidate"
        break
      fi
    done
  fi

  if [ -z "$CONFIG" ]; then
    cat >&2 <<'EOF'
No Jira credentials available.

Easiest in the FlowKeeper sandbox: set ATLASSIAN_BASIC_AUTH (base64 of
"email:api_token") — fk() already does this from the macOS keychain.

In Cowork (or any non-sandbox run), create a config file at
~/FlowKeeper/.fk-po/jira.env on the user's Mac:

    mkdir -p ~/FlowKeeper/.fk-po
    cat > ~/FlowKeeper/.fk-po/jira.env <<'CONF'
    JIRA_EMAIL=you@flowkeeper.nl
    JIRA_API_TOKEN=ATATT3xxxxxxxx
    CONF
    chmod 600 ~/FlowKeeper/.fk-po/jira.env

See setup-jira-attachments.md in this skill folder for the full walkthrough,
including which token type to mint at id.atlassian.com.
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

# --- Upload each file --------------------------------------------------------
FAILED=0
SUCCEEDED=0

for FILE in "$@"; do
  if [ ! -f "$FILE" ]; then
    echo "skip (not a file): $FILE" >&2
    FAILED=$((FAILED + 1))
    continue
  fi

  NAME="$(basename "$FILE")"
  TMP_BODY="$(mktemp)"
  # curl prints '000' via -w on connection failure, so no fallback needed.
  # Keep curl stderr — it explains transport-level errors. Use set +e locally
  # in case the surrounding shell has `set -e`.
  set +e
  HTTP_CODE="$(curl -sS -o "$TMP_BODY" -w '%{http_code}' \
    -X POST \
    "${CURL_AUTH_ARGS[@]}" \
    -H 'X-Atlassian-Token: no-check' \
    -F "file=@${FILE}" \
    "$JIRA_API_URL/rest/api/3/issue/$ISSUE_KEY/attachments")"
  set -e
  # Defensive: if curl printed nothing usable, normalise to 000.
  case "$HTTP_CODE" in
    [0-9][0-9][0-9]) : ;;
    *) HTTP_CODE="000" ;;
  esac

  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "ok   ${NAME}  (HTTP ${HTTP_CODE})"
    SUCCEEDED=$((SUCCEEDED + 1))
  else
    echo "FAIL ${NAME}  (HTTP ${HTTP_CODE})" >&2
    echo "     response: $(head -c 500 "$TMP_BODY")" >&2
    FAILED=$((FAILED + 1))
  fi
  rm -f "$TMP_BODY"
done

echo "---"
echo "Attached ${SUCCEEDED} file(s) to ${ISSUE_KEY}. ${FAILED} failed."

if [ "$FAILED" -gt 0 ]; then
  exit 3
fi

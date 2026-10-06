#!/usr/bin/env bash
#
# Live preview of the help video. Opens Remotion Studio on the LAST rendered
# work dir, so you can scrub the timeline, edit remotion/tweaks.ts and see the
# change immediately. No re-recording, no text to speech, no API credit.
#
#   ./studio.sh                     use whatever render-help.mjs staged last
#   ./studio.sh --work <dir>        stage a specific run first
#   ./studio.sh --port 3211         pick another port
#
# On a Mac the studio runs directly. Inside the claude-sandbox it runs in a
# container, because the sandbox publishes no ports to the Mac.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3211
WORK=""

while [ $# -gt 0 ]; do
  case "$1" in
    --work) WORK="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -n "$WORK" ]; then
  echo "[studio] staging $WORK"
  node "$HERE/stage-only.mjs" --work "$WORK"
fi

if [ ! -f "$HERE/remotion/public/capture.mp4" ]; then
  echo "[studio] nothing staged yet. Render once, or pass --work <dir>." >&2
  exit 1
fi

if [ ! -f "$HERE/remotion/public/studio-props.json" ]; then
  echo "[studio] no studio-props.json; re-run with --work <dir>." >&2
  exit 1
fi

STUDIO_ARGS="remotion/index.ts --public-dir remotion/public --props remotion/public/studio-props.json"

if [ ! -f /.dockerenv ]; then
  echo "[studio] starting on http://localhost:$PORT (Ctrl+C stops it)"
  echo "[studio] edit remotion/tweaks.ts and the preview reloads by itself"
  cd "$HERE"
  # shellcheck disable=SC2086
  exec npx remotion studio $STUDIO_ARGS --port "$PORT"
fi

# The Docker socket is the Mac's, so the mount needs the HOST path of this
# directory: the sandbox mounts HOST_WORKSPACE at /workspace.
if [ -z "${HOST_WORKSPACE:-}" ] || [ "${HERE#/workspace/}" = "$HERE" ]; then
  echo "[studio] cannot map $HERE to a host path (HOST_WORKSPACE unset, or not under /workspace)." >&2
  exit 1
fi
HOST_HARNESS="$HOST_WORKSPACE/${HERE#/workspace/}"

NAME="fk_help_studio"
docker rm -f "$NAME" >/dev/null 2>&1 || true

echo "[studio] starting on http://localhost:$PORT"
echo "[studio] edit remotion/tweaks.ts and the preview reloads by itself"
docker run -d --name "$NAME" \
  -p "$PORT:3000" \
  -v "$HOST_HARNESS:/app" \
  -w /app \
  node:22-bookworm-slim \
  sh -c "npx remotion studio $STUDIO_ARGS --port 3000 --host 0.0.0.0" \
  >/dev/null

sleep 4
docker logs "$NAME" --tail 8 2>&1 || true
echo
echo "[studio] stop it with: docker rm -f $NAME"

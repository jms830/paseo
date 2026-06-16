#!/bin/bash
# One-command web dev: fixed-port daemon + Expo web (no portless required).
# Usage: ./scripts/dev-web.sh [PORT]
#   PORT defaults to 4111; auto-scans upward if busy.
#   Tailscale: if tailscale is running, binds to 0.0.0.0 and uses the
#   Tailscale IP for EXPO_PUBLIC_LOCAL_DAEMON so other Tailscale devices
#   (phone, laptop) can reach the app at http://<tailscale-ip>:8081.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/../node_modules/.bin:$PATH"

# Pin a STABLE PASEO_HOME so the daemon keeps the same serverId across restarts.
# dev.sh uses an ephemeral /tmp home (new serverId each launch), which makes the
# web app's persisted host registry go stale and the client loops forever probing
# a serverId that no longer exists. A fixed home avoids that. Override by exporting
# PASEO_HOME before running.
export PASEO_HOME="${PASEO_HOME:-$HOME/.paseo-dev-web}"
source "$SCRIPT_DIR/dev-home.sh"
configure_dev_paseo_home

# Pick a daemon port. Default 4111 (avoids opencode's 4096 and Paseo's 6767).
# If the chosen port is busy, auto-scan upward until a free one is found so the
# daemon never crash-loops on EADDRINUSE.
port_in_use() {
  ss -ltn 2>/dev/null | grep -qE "[:.]${1}[[:space:]]"
}

REQUESTED_PORT="${1:-4111}"
DEV_PORT="$REQUESTED_PORT"
while port_in_use "$DEV_PORT"; do
  echo "  Port ${DEV_PORT} is in use — trying $((DEV_PORT + 1))..."
  DEV_PORT=$((DEV_PORT + 1))
done

# Pick an Expo web port (default 8081). Auto-scan upward if busy so a second
# dev-web instance (or a stale Metro) doesn't collide on EADDRINUSE.
EXPO_PORT="${EXPO_PORT:-8081}"
while port_in_use "$EXPO_PORT"; do
  echo "  Expo port ${EXPO_PORT} is in use — trying $((EXPO_PORT + 1))..."
  EXPO_PORT=$((EXPO_PORT + 1))
done

if [ -z "${PASEO_LOCAL_MODELS_DIR}" ]; then
  export PASEO_LOCAL_MODELS_DIR="$HOME/.paseo/models/local-speech"
  mkdir -p "$PASEO_LOCAL_MODELS_DIR"
fi

# Detect Tailscale IP — if available, bind to all interfaces so remote
# Tailscale devices can reach both the daemon and the Expo web server.
TS_IP="$(tailscale ip -4 2>/dev/null || true)"
if [ -n "$TS_IP" ]; then
  BIND_HOST="0.0.0.0"
  PUBLIC_HOST="$TS_IP"
else
  BIND_HOST="127.0.0.1"
  PUBLIC_HOST="127.0.0.1"
fi

echo "══════════════════════════════════════════════════════"
echo "  Paseo Dev (web, fixed port)"
echo "══════════════════════════════════════════════════════"
echo "  Home:    ${PASEO_HOME}"
echo "  Daemon:  ${PUBLIC_HOST}:${DEV_PORT}  (bind: ${BIND_HOST})"
echo "  App:     http://${PUBLIC_HOST}:${EXPO_PORT}"
echo "══════════════════════════════════════════════════════"

export PASEO_CORS_ORIGINS="*"
export PASEO_NODE_INSPECT="${PASEO_NODE_INSPECT:---inspect=0}"
export PASEO_LISTEN="${BIND_HOST}:${DEV_PORT}"
export EXPO_PUBLIC_LOCAL_DAEMON="${PUBLIC_HOST}:${DEV_PORT}"

exec concurrently \
  --names "daemon,metro" \
  --prefix-colors "cyan,magenta" \
  "./scripts/dev-daemon.sh" \
  "cd packages/app && BROWSER=none APP_VARIANT=development npx expo start --web --port ${EXPO_PORT}"

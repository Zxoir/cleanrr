#!/bin/sh
set -eu

SESSION_DIR="${WHATSAPP_SESSION_PATH:-/app/session}"
RESET_ON_START="${RESET_SESSION_ON_START:-}"

# One-time forced reset (env) or marker from previous run
if [ "${RESET_ON_START}" = "true" ] || [ -f "$SESSION_DIR/.RESET" ]; then
  echo "[entrypoint] Clearing WhatsApp session at $SESSION_DIR"
  rm -rf "$SESSION_DIR" || true
  mkdir -p "$SESSION_DIR"
  # marker may not exist after rm; this is harmless
  rm -f "$SESSION_DIR/.RESET" || true
fi

exec node dist/index.js

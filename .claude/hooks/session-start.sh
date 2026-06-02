#!/bin/bash
#
# SessionStart hook for Claude Code on the web.
#
# Installs npm dependencies so the agent can run the same quality gates CI runs
# (prettier, eslint, vitest, vite build, deno check) BEFORE committing. Without
# this, a web/agent session has no node_modules, cannot run `npm run format` /
# `npm run lint` / `npm test` / `npm run build` or the lint-staged pre-commit
# hook, and ends up committing unformatted / unverified code that then fails the
# "Quality Check" workflow on push (historically the Prettier format gate).
#
# Runs synchronously so deps are guaranteed ready before the agent loop starts.
# It never aborts the session: a failed install prints a clear diagnostic and
# still exits 0 so the session can start (the agent sees the message in context).

# Note: no `-e` — we handle install failure ourselves instead of aborting.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

echo "[session-start] Installing npm dependencies (npm install)..."
# `npm install` (not `npm ci`) so the cached container layer is reused on
# resume/clear and the step is idempotent.
if npm install --no-audit --no-fund; then
  echo "[session-start] Dependencies installed. Quality gates are runnable:"
  echo "[session-start]   npm run format   # prettier --write (fix formatting before committing)"
  echo "[session-start]   npm run lint     # eslint"
  echo "[session-start]   npm run typecheck"
  echo "[session-start]   npm test         # vitest"
  echo "[session-start]   npm run build"
else
  echo "[session-start] WARNING: npm install failed — node_modules is NOT ready."
  echo "[session-start] If the error above is a 403 on https://npm.jsr.io, this"
  echo "[session-start] environment's network policy is blocking the JSR registry,"
  echo "[session-start] which hosts the @jsr/* dependencies (e.g."
  echo "[session-start] @jsr/supabase__supabase-js). Fix: allow 'npm.jsr.io' in the"
  echo "[session-start] environment's network policy (see"
  echo "[session-start] https://code.claude.com/docs/en/claude-code-on-the-web)."
  echo "[session-start] Until then the agent cannot format/lint/test/build locally,"
  echo "[session-start] so changes must be verified in CI before merging."
fi

# Always succeed so a blocked install never prevents the session from starting.
exit 0

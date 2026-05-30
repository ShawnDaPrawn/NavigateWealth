#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Installs npm dependencies so tests, typecheck, lint, and build are ready to
# run without a manual `npm install` at the start of every web session.
#
# Runs synchronously (no async flag) so the session does not start until deps
# are present — this avoids race conditions where the agent runs a tool before
# install finishes. Switch to async (see the skill docs) if faster startup is
# preferred over that guarantee.
#
# IMPORTANT — JSR registry dependency:
#   package.json pins two JSR packages (@jsr/std__encoding,
#   @jsr/supabase__supabase-js) resolved via npm.jsr.io (see .npmrc). If the
#   environment's network policy does NOT allow npm.jsr.io, `npm install` fails
#   with HTTP 403 and NOTHING installs (npm aborts the whole tree). This hook
#   detects that case and prints actionable guidance instead of failing silently.
#   Fix: widen the environment's network policy to allow npm.jsr.io
#   (https://code.claude.com/docs/en/claude-code-on-the-web), or run the session
#   under a policy that permits it.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# Only do work in the remote (web) environment; local machines manage their own
# dependencies and shouldn't be slowed down by this hook.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Already installed (container state is cached after a successful hook run) —
# nothing to do. `vitest` is a good sentinel: it's a dependency used by the
# test suite and lives in node_modules/.bin once install succeeds.
if [ -x node_modules/.bin/vitest ]; then
  echo "[session-start] node_modules already present — skipping install."
  exit 0
fi

echo "[session-start] Installing npm dependencies (npm install)..."

# Prefer `npm install` over `npm ci`: it tolerates a lockfile that is slightly
# out of sync and takes advantage of the cached container state.
if npm install --no-audit --no-fund; then
  echo "[session-start] Dependencies installed."
else
  status=$?
  echo "[session-start] ERROR: npm install failed (exit ${status})." >&2
  echo "[session-start] If the log shows '403 Forbidden ... npm.jsr.io', this" >&2
  echo "[session-start] environment's network policy is blocking the JSR" >&2
  echo "[session-start] registry. package.json requires @jsr/* packages, so" >&2
  echo "[session-start] npm aborts the entire install. Widen the environment's" >&2
  echo "[session-start] network policy to allow npm.jsr.io, then restart the" >&2
  echo "[session-start] session. Docs: https://code.claude.com/docs/en/claude-code-on-the-web" >&2
  exit "${status}"
fi

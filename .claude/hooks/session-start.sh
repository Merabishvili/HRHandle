#!/bin/bash
# Installs npm dependencies in Claude Code cloud sessions so lint, tests and build can run.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm ci keeps package-lock.json untouched (npm install rewrites it with this npm version)
npm ci --no-audit --no-fund

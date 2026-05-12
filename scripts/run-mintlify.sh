#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"

if [ -z "$NODE_VERSION" ]; then
  echo "No Node version found in .nvmrc." >&2
  exit 1
fi

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null
fi

CURRENT_NODE="$(node -v 2>/dev/null || true)"
CURRENT_MAJOR="${CURRENT_NODE#v}"
CURRENT_MAJOR="${CURRENT_MAJOR%%.*}"

if [ -z "$CURRENT_NODE" ] || [ "$CURRENT_MAJOR" -ge 25 ]; then
  cat >&2 <<EOF
Mintlify is not supported on Node 25+.

Current Node: ${CURRENT_NODE:-not found}
Required Node: $NODE_VERSION from .nvmrc

Run:
  nvm install
  nvm use
  npm run docs:dev
EOF
  exit 1
fi

cd "$ROOT_DIR/docs"
exec npx mint "$@"

#!/usr/bin/env bash
# -------------------------------------------------------------------
# format-all.sh – Run prettier across all TypeScript and JavaScript files
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/.."

MODE=--write
if [ "${1:-}" = --check ]; then MODE=--check; fi
echo "=== Formatting MsgCore ==="

# Source and tests follow the product's implementation owner.
./node_modules/.bin/prettier "$MODE" --ignore-unknown --no-error-on-unmatched-pattern \
  "*.json" "scripts/*.mjs" \
  "services/msgcore/node/{apps,packages}/*/src/**/*.ts" \
  "services/msgcore/node/{apps,packages}/*/package.json" \
  "services/msgcore/node/packages/*/tests/**/*.ts" \
  "services/msgcore/node/tests/**/*.ts" \
  "services/msgcore/**/*.mjs"

echo "=== Formatting completed ==="

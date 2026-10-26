#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../.."
exec node services/msgcore/node/apps/server/dist/bin/server.js

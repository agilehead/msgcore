#!/usr/bin/env bash
set -euo pipefail
exec node services/msgcore/node/apps/server/dist/bin/server.js

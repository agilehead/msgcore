#!/bin/bash
set -e

echo "Starting MsgCore Conversation Server..."
mkdir -p "${MSGCORE_DATA_DIR:-/app/data}"

exec ./scripts/start.sh

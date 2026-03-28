#!/bin/bash
set -e

echo "Starting MsgCore Conversation Server..."

# Ensure data directory exists for SQLite
mkdir -p "${MSGCORE_DATA_DIR:-/app/data}"

# Start the application
exec ./scripts/start.sh

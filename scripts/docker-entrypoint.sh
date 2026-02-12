#!/bin/bash
set -e

echo "Starting MsgCore Conversation Server..."

# Ensure data directory exists for SQLite
mkdir -p "${MSGCORE_DATA_DIR:-/app/data}"

# Run database migrations
echo "Running database migrations..."
./node_modules/.bin/knex migrate:latest --knexfile database/msgcore/knexfile.js
echo "Migrations complete."

# Start the application
exec ./scripts/start.sh

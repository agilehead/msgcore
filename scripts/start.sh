#!/bin/bash

# Start script for MsgCore server
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if we're in Docker (scripts in /app/scripts)
if [ -f "/app/node/packages/msgcore-server/dist/bin/server.js" ]; then
    cd /app/node/packages/msgcore-server
elif [ -d "$SCRIPT_DIR/../node/packages/msgcore-server" ]; then
    cd "$SCRIPT_DIR/../node/packages/msgcore-server"
else
    echo "Error: Cannot find msgcore-server package"
    exit 1
fi

# Start the server
node dist/bin/server.js

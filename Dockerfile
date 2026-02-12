# Build stage - Use Ubuntu to match runtime for native modules
FROM ubuntu:24.04 AS builder

# Install Node.js 24 and build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY node/packages/msgcore-logger/package*.json ./node/packages/msgcore-logger/
COPY node/packages/msgcore-db/package*.json ./node/packages/msgcore-db/
COPY node/packages/msgcore-test-utils/package*.json ./node/packages/msgcore-test-utils/
COPY node/packages/msgcore-server/package*.json ./node/packages/msgcore-server/

# Copy build scripts from scripts directory
COPY scripts/ ./scripts/

# Copy source code
COPY tsconfig.base.json ./
COPY node ./node
COPY database ./database

# Install dependencies and build
RUN chmod +x scripts/build.sh scripts/clean.sh scripts/format-all.sh scripts/install-deps.sh && \
    ./scripts/build.sh --install

# Make dist files readable by any user (for rootless Docker)
RUN chmod -R a+rX /app/node/packages/*/dist /app/database 2>/dev/null || true

# Migrations stage - runs migrations and exits
FROM ubuntu:24.04 AS migrations

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy from builder - need knex, migrations, and database access
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database/ ./database/
COPY --from=builder /app/node/packages/msgcore-db/dist ./node/packages/msgcore-db/dist
COPY --from=builder /app/node/packages/msgcore-db/package*.json ./node/packages/msgcore-db/
COPY --from=builder /app/node/packages/msgcore-logger/dist ./node/packages/msgcore-logger/dist
COPY --from=builder /app/node/packages/msgcore-logger/package*.json ./node/packages/msgcore-logger/

# Create data directory
RUN mkdir -p /app/data

CMD ["./node_modules/.bin/knex", "migrate:latest", "--knexfile", "database/msgcore/knexfile.js", "--env", "production"]

# Development stage - hot reload with source mounts
FROM builder AS development

WORKDIR /app

EXPOSE 5007

ENV NODE_ENV=development \
    MSGCORE_SERVER_HOST=0.0.0.0 \
    MSGCORE_SERVER_PORT=5007 \
    LOG_LEVEL=debug

CMD ["node", "--import", "tsx", "node/packages/msgcore-server/src/bin/server.ts"]

# Production stage
FROM ubuntu:24.04 AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application and dependencies from builder
COPY --from=builder /app/node/packages/msgcore-server/dist ./node/packages/msgcore-server/dist
COPY --from=builder /app/node/packages/msgcore-server/package*.json ./node/packages/msgcore-server/
COPY --from=builder /app/node/packages/msgcore-db/dist ./node/packages/msgcore-db/dist
COPY --from=builder /app/node/packages/msgcore-db/package*.json ./node/packages/msgcore-db/
COPY --from=builder /app/node/packages/msgcore-logger/dist ./node/packages/msgcore-logger/dist
COPY --from=builder /app/node/packages/msgcore-logger/package*.json ./node/packages/msgcore-logger/
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy database migrations and knexfile
COPY --from=builder /app/database/ ./database/

# Copy start script and entrypoint
COPY scripts/start.sh scripts/docker-entrypoint.sh ./scripts/
RUN chmod +x scripts/start.sh scripts/docker-entrypoint.sh

# Create data and log directories
RUN mkdir -p /app/data /app/logs

# Expose server port
EXPOSE 5007

# Set default environment variables (non-sensitive only)
ENV NODE_ENV=production \
    MSGCORE_SERVER_HOST=0.0.0.0 \
    MSGCORE_SERVER_PORT=5007 \
    LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.MSGCORE_SERVER_PORT || 5007) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use entrypoint for automatic setup
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]

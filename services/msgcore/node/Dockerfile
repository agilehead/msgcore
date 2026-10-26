FROM node:24.22.1-alpine AS build
WORKDIR /app
RUN apk add --no-cache bash python3 make g++
COPY package.json package-lock.json tsconfig.base.json ./
COPY services/msgcore/package.json ./services/msgcore/package.json
COPY services/msgcore/node/apps/server/package.json ./services/msgcore/node/apps/server/package.json
COPY services/msgcore/node/packages/msgcore-db/package.json ./services/msgcore/node/packages/msgcore-db/package.json
COPY services/msgcore/node/packages/msgcore-logger/package.json ./services/msgcore/node/packages/msgcore-logger/package.json
COPY services/msgcore/node/packages/msgcore-client/package.json ./services/msgcore/node/packages/msgcore-client/package.json
COPY services/msgcore/node/packages/msgcore-test-utils/package.json ./services/msgcore/node/packages/msgcore-test-utils/package.json
RUN npm ci
COPY services/msgcore/node ./services/msgcore/node
COPY services/msgcore/database ./services/msgcore/database
COPY services/msgcore/knexfile.msgcore.mjs ./services/msgcore/knexfile.msgcore.mjs
COPY scripts ./scripts
RUN ./scripts/build.sh --no-format
FROM node:24.22.1-alpine AS production
WORKDIR /app
RUN apk add --no-cache bash
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/msgcore/node ./services/msgcore/node
ENV NODE_ENV=production
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:'+process.env.MSGCORE_SERVER_PORT+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["node","services/msgcore/node/apps/server/dist/bin/server.js"]

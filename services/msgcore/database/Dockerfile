FROM node:24.22.1-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache bash python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --workspaces=false

FROM node:24.22.1-alpine AS migrations
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY services/msgcore/knexfile.msgcore.mjs ./services/msgcore/knexfile.msgcore.mjs
COPY services/msgcore/database/msgcore/sqlite/migrations ./services/msgcore/database/msgcore/sqlite/migrations
RUN mkdir -p /app/data
ENV NODE_ENV=production
CMD ["./node_modules/.bin/knex", "migrate:latest", "--knexfile", "services/msgcore/knexfile.msgcore.mjs", "--env", "production"]

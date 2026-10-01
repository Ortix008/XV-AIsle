FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=4317
ENV DATABASE_PATH=/data/xvaisle.sqlite
RUN mkdir -p /data && chown node:node /data
COPY --from=build /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/scripts/admin-create.mjs ./scripts/admin-create.mjs
COPY --from=build --chown=node:node /app/scripts/admin-reset-password.ts ./scripts/admin-reset-password.ts
COPY --from=build --chown=node:node /app/scripts/admin-status.ts ./scripts/admin-status.ts
COPY --from=build --chown=node:node /app/src/lib/server/password.ts ./src/lib/server/password.ts
COPY --from=build /app/package.json /tmp/xvaisle-package.json
RUN node -e 'const fs=require("fs"); const app=JSON.parse(fs.readFileSync("/tmp/xvaisle-package.json","utf8")); const stand=JSON.parse(fs.readFileSync("/app/package.json","utf8")); stand.scripts=Object.assign({}, stand.scripts, {"admin:create":"node scripts/admin-create.mjs","admin:reset-password":"node --experimental-strip-types scripts/admin-reset-password.ts","admin:status":"node --experimental-strip-types scripts/admin-status.ts"}); fs.writeFileSync("/app/package.json", JSON.stringify(stand,null,2)+"\n");' \
  && chown node:node /app/package.json \
  && rm /tmp/xvaisle-package.json
USER node
EXPOSE 4317
VOLUME /data
CMD ["node", "server.js"]

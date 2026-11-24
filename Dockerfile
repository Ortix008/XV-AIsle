FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV __NEXT_PREVIEW_MODE_ID=placeholder
ENV __NEXT_PREVIEW_MODE_SIGNING_KEY=placeholder
ENV __NEXT_PREVIEW_MODE_ENCRYPTION_KEY=placeholder
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=placeholder
RUN npm run build && node scripts/strip-build-keys.mjs .next

FROM node:22-bookworm-slim AS run
ARG DEPLOYED_COMMIT=unknown
WORKDIR /app
ENV NODE_ENV=production
ENV DEPLOYED_COMMIT=${DEPLOYED_COMMIT}
LABEL org.opencontainers.image.source="https://github.com/Ortix008/XV-AIsle"
LABEL org.opencontainers.image.revision="${DEPLOYED_COMMIT}"
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=4317
ENV DATABASE_PATH=/data/xvaisle.sqlite
RUN mkdir -p /data && chown node:node /data
COPY --from=build /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/scripts/admin-create.mjs ./scripts/admin-create.mjs
COPY --from=build --chown=node:node /app/scripts/catalog-import.mjs ./scripts/catalog-import.mjs
COPY --from=build --chown=node:node /app/scripts/admin-reset-password.ts ./scripts/admin-reset-password.ts
COPY --from=build --chown=node:node /app/scripts/admin-status.ts ./scripts/admin-status.ts
COPY --from=build --chown=node:node /app/scripts/apply-stock-caps.ts ./scripts/apply-stock-caps.ts
COPY --from=build --chown=node:node /app/scripts/rollback-stock-caps.ts ./scripts/rollback-stock-caps.ts
COPY --from=build --chown=node:node /app/scripts/stock-caps.json ./scripts/stock-caps.json
COPY --from=build --chown=node:node /app/src/lib/stock-caps.ts ./src/lib/stock-caps.ts
COPY --from=build --chown=node:node /app/src/lib/server/password.ts ./src/lib/server/password.ts
COPY --from=build /app/package.json /tmp/xvaisle-package.json
RUN node -e 'const fs=require("fs"); const app=JSON.parse(fs.readFileSync("/tmp/xvaisle-package.json","utf8")); const stand=JSON.parse(fs.readFileSync("/app/package.json","utf8")); stand.scripts=Object.assign({}, stand.scripts, {"admin:create":"node scripts/admin-create.mjs","admin:reset-password":"node --experimental-strip-types scripts/admin-reset-password.ts","admin:status":"node --experimental-strip-types scripts/admin-status.ts","catalog:import":"node scripts/catalog-import.mjs"}); fs.writeFileSync("/app/package.json", JSON.stringify(stand,null,2)+"\n");' \
  && chown node:node /app/package.json \
  && rm /tmp/xvaisle-package.json
RUN printf '%s\n' "$DEPLOYED_COMMIT" > /app/DEPLOYED_COMMIT && chown node:node /app/DEPLOYED_COMMIT
COPY --from=build --chown=node:node /app/scripts/docker-entrypoint.mjs ./scripts/docker-entrypoint.mjs
USER node
EXPOSE 4317
VOLUME /data
ENTRYPOINT ["node", "scripts/docker-entrypoint.mjs"]

# syntax=docker/dockerfile:1.7

FROM node:22.18.0-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma

RUN pnpm db:generate && pnpm build

FROM node:22.18.0-bookworm-slim AS api

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=8080
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app /app
COPY --chown=node:node deploy/api-entrypoint.sh /usr/local/bin/api-entrypoint
RUN chmod 0555 /usr/local/bin/api-entrypoint

USER node
EXPOSE 8080
ENTRYPOINT ["api-entrypoint"]

FROM nginx:1.28.0-alpine AS web

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

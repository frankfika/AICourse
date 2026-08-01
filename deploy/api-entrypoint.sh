#!/bin/sh
set -eu

node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

if [ "${BOOTSTRAP_DATA:-true}" = "true" ]; then
  node apps/api/dist/prisma/bootstrap-production.js
fi

# CMS settings and instructor links are idempotent and safe on every release.
node apps/api/dist/prisma/seed-cms.js
node -r ./apps/api/node_modules/ts-node/register prisma/seed-instructors.ts

exec node apps/api/dist/src/main.js

#!/bin/sh
# Runs database migrations before starting the NestJS server.
# If the migration fails (DB unreachable, schema conflict), the container exits
# immediately — this is intentional. A running app against a wrong schema is
# worse than a container that fails to start.
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting NestJS..."
exec "$@"

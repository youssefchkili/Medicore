FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Lock file was generated on Windows — it is missing Linux-specific native packages
# (@emnapi/core, @emnapi/runtime) that some deps need on Linux.
# Deleting it lets npm resolve the correct packages for Alpine Linux.
RUN rm -f package-lock.json && npm install

# Prisma client generation (requires schema to be present)
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ─── Production image ────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN rm -f package-lock.json && npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/src/main"]

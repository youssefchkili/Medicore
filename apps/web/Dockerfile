FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# The lock file was generated on Windows and pins lightningcss-win32-x64-msvc,
# a native binary that does not exist on Linux. Deleting it lets npm resolve
# the correct Linux binary (lightningcss-linux-x64-gnu) from scratch.
RUN rm -f package-lock.json && npm install

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not read
# at container runtime — .dockerignore excludes .env* from the build context,
# so they must come in as build args instead.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AI_WS_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AI_WS_URL=$NEXT_PUBLIC_AI_WS_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Production runner (uses Next.js standalone output) ──────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

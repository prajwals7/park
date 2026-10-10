# ==========================================
# Multi-stage Dockerfile for @wpd/api (NestJS)
# ==========================================

# 1. Base Stage
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl dumb-init openssl
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

# 2. Builder Stage
FROM base AS builder
WORKDIR /app

# Copy root workspace configurations
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy shared code & compile
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
RUN pnpm --filter @wpd/shared build

# Copy API source and generate Prisma Client
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm build

# 3. Production Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init curl openssl

ENV NODE_ENV=production
ENV PORT=4000

# Run container as non-root user
USER node

# Copy compiled artifacts and production dependencies
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000

# Docker Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/dist/src/main.js"]

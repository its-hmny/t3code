# syntax=docker/dockerfile:1

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:24-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches/ patches/

# Copy all package.json files so pnpm can resolve the workspace graph
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/shared/package.json packages/shared/
COPY packages/client-runtime/package.json packages/client-runtime/

# Install all dependencies (including dev, needed for build tools like vp)
RUN pnpm install --frozen-lockfile

# Copy full source (after install for cache efficiency)
COPY . .

# Build the web app first (server build depends on it)
RUN pnpm --filter @t3tools/web run build

# Build the server bundle and bundle the web client into dist/client/
# cli.ts runs `vp pack` then copies apps/web/dist → dist/client/
WORKDIR /app/apps/server
RUN node scripts/cli.ts build

# Create a standalone deployment directory with only production deps
WORKDIR /app
RUN pnpm deploy --filter t3 --prod /deploy

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

# node-pty needs a functional Python + make for potential recompilation on
# architecture mismatches; installing build tools keeps the image self-contained.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the standalone deployment (dist/ + node_modules/ + package.json)
COPY --from=builder /deploy .

# Web app is already embedded at dist/client/ by the server build step.
# T3CODE_HOME is the data directory (sessions, settings, SQLite db).
# Override with a bind-mount or named volume in docker-compose.yml.
ENV T3CODE_HOME=/data \
    T3CODE_HOST=0.0.0.0 \
    T3CODE_PORT=3773 \
    T3CODE_NO_BROWSER=true \
    T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD=false

EXPOSE 3773

# Persist data across container restarts
VOLUME ["/data"]

CMD ["node", "dist/bin.mjs"]

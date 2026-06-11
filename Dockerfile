# syntax=docker/dockerfile:1

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:24-slim AS builder

# Build tools required by native modules (node-pty compiles from source on Linux
# because it ships prebuilds only for macOS and Windows).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Pin pnpm to the same version declared in package.json#packageManager.
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

WORKDIR /app

# Skip Electron binary download — the desktop app is not needed in this image.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

# Copy the full monorepo. pnpm needs every workspace package.json (17+ files
# across apps/, packages/, infra/, etc.) to resolve the dependency graph;
# partial COPY breaks --frozen-lockfile.
COPY . .

# Install all workspace dependencies (dev deps included — needed for build tools
# like vp/vite-plus used in the build steps below).
RUN pnpm install --frozen-lockfile

# Build the web app first (server build embeds it into dist/client/).
RUN pnpm --filter @t3tools/web run build

# Bundle the server and embed the web client into dist/client/.
# cli.ts: runs `vp pack` (build:bundle) then copies apps/web/dist → dist/client/
WORKDIR /app/apps/server
RUN node scripts/cli.ts build

# Create a standalone deployment with only production dependencies.
# --legacy is required for pnpm v10 when inject-workspace-packages is not set.
WORKDIR /app
RUN pnpm deploy --filter t3 --prod --legacy /deploy

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

WORKDIR /app

# Copy the standalone deployment (dist/ + node_modules/ + package.json).
# dist/client/ contains the pre-built web app; no separate web process needed.
COPY --from=builder /deploy .

# T3CODE_HOME: data directory (sessions, settings, SQLite DB).
# Mount a named volume here to persist data across container restarts.
ENV T3CODE_HOME=/data \
    T3CODE_HOST=0.0.0.0 \
    T3CODE_PORT=3773 \
    T3CODE_NO_BROWSER=true \
    T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD=false

EXPOSE 3773
VOLUME ["/data"]

CMD ["node", "dist/bin.mjs"]

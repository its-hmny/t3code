# Fork Changelog

This file tracks all changes made in this fork (`its-hmny/t3code`) relative to the upstream repository (`pingdotgg/t3code`).

Its purpose is to make it easy to rebase or re-apply our changes when syncing with upstream.

## Syncing with upstream

```bash
git fetch upstream
git rebase upstream/main
# resolve any conflicts, then:
git push origin main --force
```

---

## Changes

### GitHub Copilot provider integration

**Commits:** `7f7c8ac` · `e77bfa4` · `2e09c83`
**Files added:**

- `apps/server/src/provider/Drivers/CopilotDriver.ts`
- `apps/server/src/provider/Layers/CopilotAdapter.ts`
- `apps/server/src/provider/Layers/CopilotProvider.ts`
- `apps/server/src/provider/Services/CopilotAdapter.ts`
- `apps/server/src/provider/acp/CopilotAcpSupport.ts`
- `apps/server/src/textGeneration/CopilotTextGeneration.ts`

**Files modified:**

- `packages/contracts/src/model.ts` — added Copilot model types
- `packages/contracts/src/settings.ts` — added Copilot provider schemas
- `apps/server/src/provider/builtInDrivers.ts` — registered `CopilotDriver`
- `apps/web/src/components/settings/providerDriverMeta.ts` — added Copilot metadata
- `apps/web/src/components/settings/AddProviderInstanceDialog.tsx` — Copilot setup flow
- `apps/web/src/components/chat/ModelPickerSidebar.tsx` — Copilot model listing
- `apps/web/src/components/chat/providerIconUtils.ts` — Copilot icon
- `apps/web/src/session-logic.ts` — Copilot session handling

**Summary:** Adds GitHub Copilot as a first-class provider, including OAuth-based authentication, ACP protocol support, model enumeration, and full UI integration alongside the existing Codex and Claude drivers.

**Potential rebase conflicts:** Any upstream changes to `builtInDrivers.ts`, `model.ts`, `settings.ts`, or the shared web settings/model-picker components will likely conflict and need manual merging.

---

### Per-project color customization

**Commit:** `9d6f2b9`
**Files added:** —
**Files modified:**

- `packages/contracts/src/settings.ts` — added `ProjectCustomization` schema and `projectCustomizations` record to `ClientSettings`/`ClientSettingsPatch`
- `apps/web/src/components/ProjectFavicon.tsx` — renders a colored dot when a customization is present
- `apps/web/src/components/Sidebar.tsx` — color palette, "Customize project…" context-menu entry, and customize dialog
- `apps/desktop/src/settings/DesktopClientSettings.test.ts` — updated fixture
- `apps/web/src/localApi.test.ts` — updated fixtures

**Summary:** Right-clicking a project in the sidebar now shows a "Customize project…" option that opens a dialog with a 12-color palette. The chosen color is stored in `localStorage` (client settings) and shown as a colored dot replacing the default favicon in the sidebar.

**Potential rebase conflicts:** Upstream changes to `ClientSettings`/`ClientSettingsPatch` in `settings.ts`, or changes to `Sidebar.tsx` project context-menu/dialogs, will conflict.

---

### Native OS notifications on thread completion

**Commit:** `d17ca70`
**Files added:**

- `apps/web/src/hooks/useThreadCompletionNotifications.ts`

**Files modified:**

- `packages/contracts/src/settings.ts` — added `notifyOnThreadCompletion` boolean to `ClientSettings`/`ClientSettingsPatch`
- `apps/web/src/routes/__root.tsx` — mounts `ThreadCompletionNotificationsBootstrap` when authenticated
- `apps/web/src/components/settings/SettingsPanels.tsx` — toggle in the General settings panel

**Summary:** Opt-in setting (Settings → General → "Thread completion notifications") that fires a native OS notification whenever a thread transitions from Working to any settled state (completed, awaiting input, pending approval, plan ready). Uses `favicon-32x32.png` as the notification icon. Clicking the notification focuses the window. Permission is requested automatically on first enable.

**Potential rebase conflicts:** Upstream changes to `ClientSettings`/`ClientSettingsPatch` in `settings.ts`, or to `__root.tsx` or `SettingsPanels.tsx`, will conflict.

---

### Compilation fixes after upstream rebase

**Commit:** `ba02e6a5`
**Files added:**

- `packages/shared/src/index.ts` — barrel export for shared utilities

**Files modified:**

- `package.json` — pinned `turbo` to `2.9.14` to fix build compatibility
- `packages/shared/package.json` — set `private: false` so workspace resolution works
- `packages/client-runtime/src/advertisedEndpoint.test.ts` — updated import to use package path instead of relative file path

**Summary:** Patches introduced during rebase that caused frontend compilation to fail. Pinning turbo and fixing the shared package visibility resolved the build errors.

**Potential rebase conflicts:** If upstream changes `turbo` version or `packages/shared/package.json`, this may need revisiting.

---

### Dynamic browser tab title + remove stage label

**Commits:** `0b190409` · `c96be589`
**Files modified:**

- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx` — sets `document.title` to `"<ProjectName> — T3 Code"` when a thread is open, resets to default on unmount
- `apps/web/src/branding.ts` — removed the stage label `(Alpha)` from `APP_DISPLAY_NAME`; the app now simply shows "T3 Code"

**Summary:** The browser tab title now reflects the currently open project, making it easy to distinguish tabs across windows and desktops. The `(Alpha)` suffix has also been dropped from the app name.

**Potential rebase conflicts:** Unlikely — these are isolated to `branding.ts` and the thread route component.

---

### CI: switch to standard GitHub-hosted runners + fix test/typecheck failures

**Commits:** `22a603e5` · `3319b18f`
**Files modified:**

- `.github/workflows/ci.yml` — replaced `blacksmith-*vcpu-ubuntu-2404` → `ubuntu-24.04`, `blacksmith-*vcpu-macos-26` → `macos-15`
- `.github/workflows/mobile-eas-preview.yml` — same runner substitution
- `.github/workflows/deploy-relay.yml` — same runner substitution
- `.github/workflows/release.yml` — same runner substitution (linux/mac/windows matrix)
- `apps/web/src/branding.ts` — `APP_DISPLAY_NAME` now appends `HOSTED_APP_CHANNEL_LABEL` (nightly/latest) when set
- `apps/web/src/cloud/linkEnvironment.ts` — `decodedRelayClientError` strips raw `HttpClientError` from `CloudEnvironmentLinkError.cause` to avoid Effect hashing raw HTTP objects
- `apps/web/src/cloud/linkEnvironment.test.ts` — transport-failure test uses HTTP 502 (not in `RelayEnvironmentLinkErrors`) instead of 503, avoiding `causeCombine` hashing of bun's GC-detached request-body `Uint8Array`
- `apps/web/src/components/chat/MessagesTimeline.test.tsx` — pre-loads module in `beforeAll` with a 30 s timeout to avoid cold-import timeout on the default 15 s limit
- `apps/server/src/provider/Layers/CopilotAdapter.ts` — fixed imports (`makeAcpNativeLoggerFactory`, `Crypto` service), use `crypto.randomUUIDv4`, add `mapExtensionFailure`, fix notification-fiber and finalizer error handling
- `apps/server/src/provider/Drivers/CopilotDriver.ts` — added `Crypto.Crypto` to `CopilotDriverEnv` type
- `packages/client-runtime/src/managedRelay.ts` — `relayClientError` now drops `HttpClientError` instances from `cause` to prevent bun GC-detached `ArrayBuffer` crashes when Effect hashes `Data.TaggedError` fields during `causeCombine` deduplication

**Summary:** Migrates all CI workflows from the Blacksmith runner service to standard GitHub-hosted runners (`ubuntu-24.04`, `macos-15`, `windows-2025`). Alongside this, fixes a batch of test and typecheck failures that surfaced after the dependency install: formatting, a branding test, a React component import-timeout test, multiple TypeScript errors in `CopilotAdapter`/`CopilotDriver`, and a subtle bun-specific crash where Effect's structural hash walks into a GC-detached `ArrayBuffer` inside a sent HTTP request body.

**Potential rebase conflicts:** Upstream changes to any of the workflow files or the files listed above will conflict.


**Commits:** `78851f6d`
**Files modified:**

- `apps/web/src/index.css` — replaced the default neutral palette with Ayu colors for both `:root` (light) and `@variant dark`

**Summary:** Applies the [Ayu color scheme](https://github.com/ayu-theme/ayu-colors) to both light and dark modes.

- **Dark:** background `#0d1017`/`#10141c`, foreground `#bfbdb6`, golden accent `#e6b450`
- **Light:** background `#f8f9fa`/`#fcfcfc`, foreground `#5c6166`, orange accent `#f29718`
- Semantic tokens (info, success, warning, destructive) mapped to their Ayu palette equivalents. Light theme unchanged visually for non-dark users.

**Potential rebase conflicts:** Any upstream changes to `apps/web/src/index.css` (theme variables) will conflict directly.

### Docker Compose for local development

**Commits:** `161859cd` · `TBD` (fix build)
**Files added:**

- `Dockerfile` — multi-stage build (Node 24, pnpm, builds web + server bundle, deploys to slim runtime image)
- `docker-compose.yml` — single `server` service with `restart: unless-stopped`, named volume for `T3CODE_HOME`, port 3773
- `.dockerignore` — excludes `node_modules/`, build artifacts, `.repos/`, and editor files

**Summary:** Adds `docker compose up --build` support for running the t3code server locally with automatic restart across reboots. The Dockerfile uses a two-stage build: the builder stage installs all workspace dependencies with pnpm, builds the web app, runs `apps/server/scripts/cli.ts build` (which bundles the server via `vp pack` and embeds the web client into `dist/client/`), then uses `pnpm deploy --prod` to produce a minimal standalone deployment. The runtime stage copies the deployment into a `node:24-slim` image. Data (sessions, settings, SQLite DB) is persisted in a named Docker volume. To mount your local projects into the container for agent access, uncomment the bind-mount section in `docker-compose.yml`.

**Potential rebase conflicts:** These files are new — no upstream conflict expected unless the upstream adds its own Docker setup.

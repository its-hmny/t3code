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

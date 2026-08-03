# Fork Changes

This repository is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code).

The following commits are fork-specific additions on top of upstream `main`:

| SHA | Description |
|-----|-------------|
| `c09715101` | feat(contracts): add Copilot driver kind, settings, and project customization schemas |
| `98145375f` | feat(server,web): add GitHub Copilot provider integration |
| `8274705f6` | fix(server): propagate provider errors and interrupted turns correctly |
| `7f41b09c0` | feat(web): OS notifications on thread completion |
| `44d537504` | feat(web): apply Ayu color theme |
| `5aa6ed620` | feat(web): set tab title to active project name |
| `e7226e6fa` | feat(web): render project color customization in favicon |
| `9efeb7e91` | feat(web): enable sidebar v2 by default for all users |

## Summary of changes

### GitHub Copilot provider (`c09715101`, `98145375f`)

Adds full Copilot as a coding provider alongside Codex, Claude, Cursor, Grok, and OpenCode.

**New files:**
- `apps/server/src/provider/Drivers/CopilotDriver.ts`
- `apps/server/src/provider/Layers/CopilotAdapter.ts`
- `apps/server/src/provider/Layers/CopilotProvider.ts`
- `apps/server/src/provider/Services/CopilotAdapter.ts`
- `apps/server/src/provider/acp/CopilotAcpSupport.ts`
- `apps/server/src/textGeneration/CopilotTextGeneration.ts`

**Modified files:**
- `packages/contracts/src/model.ts` — `COPILOT_DRIVER_KIND` + model map entries
- `packages/contracts/src/settings.ts` — `CopilotSettings`, `CopilotSettingsPatch`, `copilot` in providers, `ProjectCustomization`
- `apps/server/src/provider/builtInDrivers.ts` — registers `CopilotDriver`
- `apps/web/src/components/settings/providerDriverMeta.ts` — Copilot settings UI entry
- `apps/web/src/components/chat/providerIconUtils.ts` — Copilot icon mapping
- `apps/web/src/session-logic.ts` — Copilot in `PROVIDER_OPTIONS`

### Provider error propagation (`8274705f6`)

Ensures interrupted or errored turns are correctly reflected in thread state rather than silently dropped.

**Modified files:**
- `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
- `apps/server/src/provider/Layers/ProviderService.ts`
- `apps/server/src/provider/Layers/CodexAdapter.ts`
- `apps/server/src/provider/Layers/CursorAdapter.ts`
- `apps/server/src/provider/Layers/GrokAdapter.ts`

### OS thread completion notifications (`7f41b09c0`)

Sends a native OS notification when a thread finishes, with a toggle in Appearance settings.

**New files:**
- `apps/web/src/hooks/useThreadCompletionNotifications.ts`

**Modified files:**
- `apps/web/src/routes/__root.tsx`
- `apps/web/src/components/settings/SettingsPanels.tsx`

### Ayu color theme (`44d537504`)

Replaces the default zinc palette with Ayu-inspired colors.

- Light: `#f8f9fa` background, `#5c6166` foreground, `#f29718` primary
- Dark: `#0d1017` background, `#bfbdb6` foreground, `#e6b450` primary

**Modified files:**
- `apps/web/src/index.css`

### Per-project tab title (`5aa6ed620`)

Sets the browser tab title to `<project name> — T3 Code` when a thread is open.

**Modified files:**
- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`

### Project color in favicon (`e7226e6fa`)

Renders a colored dot in the favicon when the project has a custom color via `ProjectCustomization`.

**Modified files:**
- `apps/web/src/components/ProjectFavicon.tsx`

### Sidebar v2 on by default (`9efeb7e91`)

Forces the new sidebar layout for all users instead of the upstream gradual rollout.

**Modified files:**
- `apps/web/src/branding.logic.ts`
- `apps/web/src/branding.test.ts`

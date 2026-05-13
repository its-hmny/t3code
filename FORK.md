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

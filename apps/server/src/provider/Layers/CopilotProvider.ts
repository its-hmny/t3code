/**
 * CopilotProvider — status checking and model discovery for the GitHub Copilot CLI.
 *
 * @module CopilotProvider
 */
import type {
  CopilotSettings,
  ModelCapabilities,
  ServerProvider,
  ServerProviderAuth,
  ServerProviderModel,
  ServerProviderState,
} from "@t3tools/contracts";
import { ProviderDriverKind } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createModelCapabilities } from "@t3tools/shared/model";
import { HostProcessPlatform } from "@t3tools/shared/hostProcess";

import {
  buildServerProvider,
  collectStreamAsString,
  isCommandMissingCause,
  providerModelsFromSettings,
  type CommandResult,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance.ts";
import { AcpSessionRuntime, layer as acpSessionRuntimeLayer } from "../acp/AcpSessionRuntime.ts";
import { buildCopilotAcpSpawnInput } from "../acp/CopilotAcpSupport.ts";

const PROVIDER = ProviderDriverKind.make("copilot");
const COPILOT_PRESENTATION = {
  displayName: "GitHub Copilot",
  showInteractionModeToggle: true,
} as const;
const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const VERSION_TIMEOUT_MS = 8_000;

// ── Version parsing ──────────────────────────────────────────────────────────

export interface CopilotVersionResult {
  readonly version: string | null;
  readonly status: Exclude<ServerProviderState, "disabled">;
  readonly auth: ServerProviderAuth;
  readonly message?: string;
}

/**
 * Parse the output of `copilot version`.
 * Example: `GitHub Copilot CLI 1.0.45`
 */
export function parseCopilotVersionOutput(result: CommandResult): CopilotVersionResult {
  const combined = `${result.stdout}\n${result.stderr}`;
  const lowerOutput = combined.toLowerCase();

  if (result.code !== 0) {
    if (isCommandMissingCause({ message: combined })) {
      return {
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message:
          "GitHub Copilot CLI (`copilot`) is not installed or not on PATH. Run `npm install -g @github/copilot-cli` or download from GitHub.",
      };
    }
    return {
      version: null,
      status: "error",
      auth: { status: "unknown" },
      message: `Failed to run Copilot CLI health check (exit code ${result.code}).`,
    };
  }

  if (
    lowerOutput.includes("enoent") ||
    lowerOutput.includes("not found") ||
    lowerOutput.includes("command not found")
  ) {
    return {
      version: null,
      status: "error",
      auth: { status: "unknown" },
      message: "GitHub Copilot CLI (`copilot`) is not installed or not on PATH.",
    };
  }

  const versionMatch = combined.match(/GitHub Copilot CLI\s+(\d+\.\d+\.\d+)/i);
  const version = versionMatch?.[1]?.trim() ?? null;

  return {
    version,
    status: "ready",
    auth: { status: "unknown" },
  };
}

/**
 * Detect auth status from environment variables.
 * The Copilot CLI checks COPILOT_GITHUB_TOKEN, GH_TOKEN, GITHUB_TOKEN in order.
 */
export function detectCopilotAuthFromEnvironment(
  environment: NodeJS.ProcessEnv,
): ServerProviderAuth {
  const token =
    environment["COPILOT_GITHUB_TOKEN"] ?? environment["GH_TOKEN"] ?? environment["GITHUB_TOKEN"];
  if (token?.trim()) {
    return { status: "authenticated" };
  }
  return { status: "unknown" };
}

// ── Model discovery ──────────────────────────────────────────────────────────

function findModelConfigOption(
  configOptions: ReadonlyArray<import("effect-acp/schema").SessionConfigOption>,
): import("effect-acp/schema").SessionConfigOption | undefined {
  return configOptions.find((option) => option.category === "model");
}

function flattenSelectOptions(
  configOption: import("effect-acp/schema").SessionConfigOption | undefined,
): ReadonlyArray<{ value: string; name: string }> {
  if (!configOption || configOption.type !== "select") {
    return [];
  }
  return configOption.options.flatMap((entry) =>
    "value" in entry
      ? [{ value: entry.value.trim(), name: entry.name.trim() }]
      : entry.options.map((option) => ({
          value: option.value.trim(),
          name: option.name.trim(),
        })),
  );
}

export function buildCopilotModelsFromConfigOptions(
  configOptions: ReadonlyArray<import("effect-acp/schema").SessionConfigOption> | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!configOptions || configOptions.length === 0) {
    return [];
  }
  const modelOption = findModelConfigOption(configOptions);
  const modelChoices = flattenSelectOptions(modelOption);
  if (!modelOption || modelChoices.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  return modelChoices.flatMap((modelChoice) => {
    const slug = modelChoice.value.trim();
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    return [
      {
        slug,
        name: modelChoice.name.trim(),
        isCustom: false,
        capabilities: EMPTY_CAPABILITIES,
      } satisfies ServerProviderModel,
    ];
  });
}

const makeCopilotAcpProbeRuntime = (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const acpContext = yield* Layer.build(
      acpSessionRuntimeLayer({
        spawn: buildCopilotAcpSpawnInput(copilotSettings, process.cwd(), environment),
        cwd: process.cwd(),
        clientInfo: { name: "t3-code-provider-probe", version: "0.0.0" },
        authMethodId: "copilot_login",
      }).pipe(Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))),
    );
    return yield* Effect.service(AcpSessionRuntime).pipe(Effect.provide(acpContext));
  });

const withCopilotAcpProbeRuntime = <A, E, R>(
  copilotSettings: CopilotSettings,
  useRuntime: (acp: AcpSessionRuntime["Service"]) => Effect.Effect<A, E, R>,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  makeCopilotAcpProbeRuntime(copilotSettings, environment).pipe(
    Effect.flatMap(useRuntime),
    Effect.scoped,
  );

export const discoverCopilotModelsViaAcp = (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  withCopilotAcpProbeRuntime(
    copilotSettings,
    (acp) =>
      Effect.map(acp.start(), (started) =>
        buildCopilotModelsFromConfigOptions(started.sessionSetupResult.configOptions ?? []),
      ),
    environment,
  );

export function getCopilotFallbackModels(
  copilotSettings: Pick<CopilotSettings, "customModels">,
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings([], copilotSettings.customModels, EMPTY_CAPABILITIES);
}

// ── Snapshot building ────────────────────────────────────────────────────────

export function buildCopilotProviderSnapshot(input: {
  readonly checkedAt: string;
  readonly copilotSettings: CopilotSettings;
  readonly parsed: CopilotVersionResult;
  readonly auth?: ServerProviderAuth;
  readonly discoveredModels?: ReadonlyArray<ServerProviderModel>;
  readonly discoveryWarning?: string;
}): ServerProviderDraft {
  const auth = input.auth ?? input.parsed.auth;
  const message =
    [input.parsed.message, input.discoveryWarning]
      .map((m) => m?.trim())
      .filter((m): m is string => Boolean(m))
      .join(" ") || undefined;

  return buildServerProvider({
    presentation: COPILOT_PRESENTATION,
    enabled: input.copilotSettings.enabled,
    checkedAt: input.checkedAt,
    models: providerModelsFromSettings(
      input.discoveredModels ?? [],
      input.copilotSettings.customModels,
      EMPTY_CAPABILITIES,
    ),
    probe: {
      installed: input.parsed.status !== "error" || !message?.includes("not installed"),
      version: input.parsed.version,
      status:
        input.discoveryWarning && input.parsed.status === "ready" ? "warning" : input.parsed.status,
      auth,
      ...(message ? { message } : {}),
    },
  });
}

export function buildInitialCopilotProviderSnapshot(
  copilotSettings: CopilotSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = getCopilotFallbackModels(copilotSettings);

    if (!copilotSettings.enabled) {
      return buildServerProvider({
        presentation: COPILOT_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "GitHub Copilot is disabled in T3 Code settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking GitHub Copilot CLI availability...",
      },
    });
  });
}

// ── Status check ─────────────────────────────────────────────────────────────

const runCopilotVersionCommand = (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const hostPlatform = yield* HostProcessPlatform;
    const command = ChildProcess.make(copilotSettings.binaryPath, ["version"], {
      env: environment,
      shell: hostPlatform === "win32",
    });
    const child = yield* spawner.spawn(command);
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        collectStreamAsString(child.stdout),
        collectStreamAsString(child.stderr),
        child.exitCode.pipe(Effect.map(Number)),
      ],
      { concurrency: "unbounded" },
    );
    return { stdout, stderr, code: exitCode } satisfies CommandResult;
  }).pipe(Effect.scoped);

export const checkCopilotProviderStatus = Effect.fn("checkCopilotProviderStatus")(function* (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.fn.Return<ServerProviderDraft, never, ChildProcessSpawner.ChildProcessSpawner> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const fallbackModels = getCopilotFallbackModels(copilotSettings);

  if (!copilotSettings.enabled) {
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: false,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "GitHub Copilot is disabled in T3 Code settings.",
      },
    });
  }

  const versionProbe = yield* runCopilotVersionCommand(copilotSettings, environment).pipe(
    Effect.timeoutOption(VERSION_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionProbe)) {
    const error = versionProbe.failure;
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: !isCommandMissingCause(error),
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: isCommandMissingCause(error)
          ? "GitHub Copilot CLI (`copilot`) is not installed or not on PATH."
          : `Failed to execute Copilot CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
      },
    });
  }

  if (Option.isNone(versionProbe.success)) {
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: "GitHub Copilot CLI timed out while running `copilot version`.",
      },
    });
  }

  const parsed = parseCopilotVersionOutput(versionProbe.success.value);
  // Check for token-based auth in environment
  const envAuth = detectCopilotAuthFromEnvironment(environment);
  const effectiveAuth: ServerProviderAuth =
    envAuth.status === "authenticated" ? envAuth : parsed.auth;

  return buildCopilotProviderSnapshot({
    checkedAt,
    copilotSettings,
    parsed,
    auth: effectiveAuth,
  });
});

// ── Background enrichment ────────────────────────────────────────────────────

export const enrichCopilotSnapshot = (input: {
  readonly settings: CopilotSettings;
  readonly environment?: NodeJS.ProcessEnv;
  readonly snapshot: ServerProvider;
  readonly maintenanceCapabilities: ProviderMaintenanceCapabilities;
  readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
  readonly stampIdentity?: (snapshot: ServerProvider) => ServerProvider;
  readonly httpClient: HttpClient.HttpClient;
}): Effect.Effect<void, never, ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto> => {
  const { settings, snapshot, publishSnapshot } = input;
  const stampIdentity = input.stampIdentity ?? ((value) => value);

  const enrichVersionAdvisory = enrichProviderSnapshotWithVersionAdvisory(
    snapshot,
    input.maintenanceCapabilities,
  ).pipe(
    Effect.provideService(HttpClient.HttpClient, input.httpClient),
    Effect.flatMap((enrichedSnapshot) =>
      publishSnapshot(stampIdentity(enrichedSnapshot)).pipe(Effect.as(enrichedSnapshot)),
    ),
    Effect.catchCause((cause) =>
      Effect.logWarning("Copilot version advisory enrichment failed", {
        cause: Cause.pretty(cause),
      }).pipe(Effect.as(snapshot)),
    ),
  );

  return enrichVersionAdvisory.pipe(
    Effect.flatMap((baseSnapshot) => {
      if (!settings.enabled || baseSnapshot.auth.status === "unauthenticated") {
        return Effect.void;
      }

      const nonCustomModels = baseSnapshot.models.filter((m) => !m.isCustom);
      const modelsNeedDiscovery =
        nonCustomModels.length === 0 ||
        nonCustomModels.some((m) => (m.capabilities?.optionDescriptors?.length ?? 0) === 0);
      if (!modelsNeedDiscovery) {
        return Effect.void;
      }

      return discoverCopilotModelsViaAcp(settings, input.environment).pipe(
        Effect.flatMap((discoveredModels) => {
          if (discoveredModels.length === 0) return Effect.void;
          return publishSnapshot(
            stampIdentity({
              ...baseSnapshot,
              models: providerModelsFromSettings(
                discoveredModels,
                settings.customModels,
                EMPTY_CAPABILITIES,
              ),
            }),
          );
        }),
        Effect.catchCause((cause) =>
          Effect.logWarning("Copilot ACP background capability enrichment failed", {
            cause: Cause.pretty(cause),
          }).pipe(Effect.asVoid),
        ),
      );
    }),
  );
};

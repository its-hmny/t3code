/**
 * CopilotAcpSupport — ACP spawn helpers for the GitHub Copilot CLI.
 *
 * The Copilot CLI is launched with `copilot --acp` to enter ACP server mode.
 *
 * @module CopilotAcpSupport
 */
import type { CopilotSettings } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpErrors from "effect-acp/errors";

import {
  AcpSessionRuntime,
  type AcpSessionRuntimeOptions,
  type AcpSessionRuntimeShape,
  type AcpSpawnInput,
} from "./AcpSessionRuntime.ts";

type CopilotAcpRuntimeSettings = Pick<CopilotSettings, "binaryPath">;

export interface CopilotAcpRuntimeInput extends Omit<
  AcpSessionRuntimeOptions,
  "authMethodId" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly copilotSettings: CopilotAcpRuntimeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export function buildCopilotAcpSpawnInput(
  copilotSettings: CopilotAcpRuntimeSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSpawnInput {
  return {
    command: copilotSettings?.binaryPath || "copilot",
    args: ["--acp"],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeCopilotAcpRuntime = (
  input: CopilotAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntimeShape,
  EffectAcpErrors.AcpError,
  Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildCopilotAcpSpawnInput(
          input.copilotSettings,
          input.cwd,
          input.environment,
        ),
        authMethodId: "copilot_login",
      }).pipe(
        Layer.provide(
          Layer.succeed(
            ChildProcessSpawner.ChildProcessSpawner,
            input.childProcessSpawner,
          ),
        ),
      ),
    );
    return yield* Effect.service(AcpSessionRuntime).pipe(
      Effect.provide(acpContext),
    );
  });

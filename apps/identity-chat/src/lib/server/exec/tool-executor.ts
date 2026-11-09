import { PrincipalId, ChatSessionId, RegistryEntry, PendingToolCall, TypedError, BoundIdentityRecord, ReceiptSummary } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";
import { confirmationGate } from "../gate/confirmation-gate.js";
import { OperationFileRunner, ExecutionResult } from "./3tched-fs-runner.js";
import { identityBinder } from "../identity/identity-binder.js";

/**
 * Executable tool call with confirmation state.
 */
export interface ExecutableCall {
  entry: RegistryEntry;
  inputBytes: Uint8Array;
  confirmed: boolean;
  catalogPin: CatalogPin;
}

/**
 * Execution outcome from tool executor.
 */
export type ExecutionOutcome =
  | { kind: "receipt"; receipt: ReceiptSummary; readBack: ReadBack }
  | { kind: "denied"; diagnostic: Diagnostic }
  | { kind: "failed"; error: TypedError }
  | { kind: "unknown"; attempts: number }
  | { kind: "refused"; error: TypedError };

/**
 * Read-back result.
 */
export interface ReadBack {
  verified: boolean;
  state?: unknown;
  error?: TypedError;
}

/**
 * Diagnostic from operation failure.
 */
export interface Diagnostic {
  error: string;
  plugin: string;
  method: string;
}

/**
 * Tool executor that runs tool calls through 3tched-fs.
 */
export class ToolExecutor {
  private runner: OperationFileRunner;

  constructor(runner: OperationFileRunner = defaultRunner) {
    this.runner = runner;
  }

  /**
   * Execute a tool call.
   * Order: (1) catalog hash check, (2) mutation cross-identity check, (3) identity re-check, (4) run, (5) read-back.
   */
  async execute(session: ExecutableSession, call: ExecutableCall): Promise<ExecutionOutcome> {
    const { entry, inputBytes, confirmed, catalogPin } = call;

    // (1) Catalog hash check
    if (catalogPin.catalogHash !== session.catalogPin.catalogHash) {
      return { kind: "refused", error: makeError("missing-mount", "catalog", "Catalog changed") };
    }

    // (2) Mutation cross-identity check
    if (entry.sideEffect === "mutation") {
      const crossIdentity = this.checkCrossIdentity(entry, call.inputBytes, session);
      if (crossIdentity) {
        return { kind: "refused", error: crossIdentity };
      }
    }

    // (3) Identity re-check (mutation only)
    if (entry.sideEffect === "mutation") {
      const recheckResult = await identityBinder.recheck(session);
      if (recheckResult.equal === false) {
        return { kind: "refused", error: makeError("denial", "identity", "Identity changed") };
      }
    }

    // (4) Run the operation
    const mountPath = entry.viewKind === "3tched" ? session.mountPaths["3tched"] : session.mountPaths["threetched"];
    const identityKind = entry.viewKind === "3tched" ? "guest-kernel" : "host-session";
    const expectedSession = entry.viewKind === "threetched" ? session.identity.sessionId : undefined;

    const result = await this.runner.run({
      plugin: entry.plugin,
      method: entry.method,
      mountPath,
      identityFlag: identityKind,
      expectedSession,
      inputBytes,
      confirmSideEffects: confirmed
    });

    if (!result.success) {
      if (result.error.kind === "denial" || result.error.kind === "missing-mount") {
        return { kind: "denied", diagnostic: { error: result.error.detail ?? result.error.failingItem, plugin: entry.plugin, method: entry.method } };
      }
      return { kind: "failed", error: result.error };
    }

    // (5) Parse receipt
    const receipt = this.parseReceipt(result.stdout, entry);
    if (!receipt.success) {
      return { kind: "failed", error: makeError("unknown-outcome", "receipt", "Could not parse receipt", result.stdout) };
    }

    // Read-back for mutations
    let readBack: ReadBack = { verified: false };
    if (entry.sideEffect === "mutation") {
      readBack = await this.readBack(session, entry, receipt);
    }

    return { kind: "receipt", receipt, readBack };
  }

  /**
   * Check for cross-identity mutation targets.
   */
  private checkCrossIdentity(entry: RegistryEntry, inputBytes: Uint8Array, session: ExecutableSession): TypedError | undefined {
    const input = JSON.parse(new TextDecoder().decode(inputBytes));

    // Check for identity/session fields
    const identityFields = ["session_id", "principal_id", "principal", "identity", "genesis"];
    for (const field of identityFields) {
      if (input[field] !== undefined && input[field] !== session.identity.sessionId) {
        return makeError("denial", field, "Cross-identity mutation target", `Expected ${session.identity.sessionId}, got ${input[field]}`);
      }
    }

    return undefined;
  }

  /**
   * Read back authoritative state after mutation.
   */
  private async readBack(session: ExecutableSession, entry: RegistryEntry, receipt: ReceiptSummary): Promise<ReadBack> {
    // Placeholder - real implementation in task 10.8
    return { verified: false };
  }

  /**
   * Parse the terminal receipt from stdout.
   */
  private parseReceipt(stdout: string, entry: RegistryEntry): { success: false } | { success: true; receipt: ReceiptSummary } {
    try {
      const parsed = JSON.parse(stdout);
      if (parsed.success !== undefined && parsed.operation_id !== undefined) {
        return {
          success: true,
          receipt: {
            pluginId: entry.plugin,
            method: entry.method,
            subid: parsed.subid ?? "",
            operationId: parsed.operation_id,
            outcome: parsed.outcome ?? "unknown",
            success: parsed.success,
            eventId: parsed.event_id ?? 0,
            eventHash: parsed.event_hash ?? "",
            terminalEventId: parsed.terminal_event_id ?? 0,
            terminalEventHash: parsed.terminal_event_hash ?? ""
          }
        };
      }
    } catch (e) {
      // Fall through to success: false
    }
    return { success: false };
  }
}

export interface ExecutableSession {
  principalId: PrincipalId;
  chatSessionId: ChatSessionId;
  mountPaths: { "3tched": string; threetched: string };
  identity: BoundIdentityRecord;
  catalogPin: { catalogHash: string };
}

export const defaultRunner = { run: async (_: any) => ({ success: false, error: makeError("transport", "runner", "Runner not configured") }) };

export const toolExecutor = new ToolExecutor();

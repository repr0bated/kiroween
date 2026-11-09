import { TypedError } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";

/**
 * Unknown outcome handling for read and mutation methods.
 */
export class UnknownOutcomeHandler {
  private maxReadRepetitions: number;
  private readTimeoutMs: number;

  constructor(maxReadRepetitions: number = 3, readTimeoutMs: number = 30000) {
    this.maxReadRepetitions = maxReadRepetitions;
    this.readTimeoutMs = readTimeoutMs;
  }

  /**
   * Handle unknown outcome for read methods.
   * Up to N byte-identical repetitions, one in flight, 30s each.
   */
  async handleRead(method: string, inputBytes: Uint8Array, runner: OperationFileRunner, principalId: string, chatSessionId: string): Promise<UnknownOutcomeResult> {
    const results: string[] = [];

    for (let i = 0; i < this.maxReadRepetitions; i++) {
      const result = await runner.run({
        plugin: "",
        method,
        mountPath: "",
        identityFlag: "guest-kernel",
        inputBytes,
        confirmSideEffects: false
      });

      if (result.success) {
        return { kind: "receipt", stdout: result.stdout, stderr: result.stderr };
      }

      if (result.error.kind !== "unknown-outcome") {
        return { kind: "error", error: result.error };
      }

      // Retry on unknown outcome
      results.push(result.stdout ?? "");
    }

    // Exhausted repetitions
    return { kind: "unknown", attempts: this.maxReadRepetitions };
  }

  /**
   * Handle unknown outcome for mutation methods.
   * Zero repetitions by default (D-10), immediate unknown status.
   */
  handleMutation(method: string, inputBytes: Uint8Array, runner: OperationFileRunner, principalId: string, chatSessionId: string): UnknownOutcomeResult {
    return {
      kind: "unknown",
      attempts: 0,
      error: makeError("unknown-outcome", method, getNextStep("unknown-outcome"))
    };
  }
}

export type UnknownOutcomeResult =
  | { kind: "receipt"; stdout: string; stderr: string }
  | { kind: "error"; error: TypedError }
  | { kind: "unknown"; attempts: number; error?: TypedError };

export const unknownOutcomeHandler = new UnknownOutcomeHandler();

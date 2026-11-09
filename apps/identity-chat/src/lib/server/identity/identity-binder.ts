import { PrincipalId, BoundIdentityRecord, PublicIdentityFields, TypedError, ReceiptSummary } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";
import { OperationFileRunner, ExecutionResult } from "../exec/3tched-fs-runner.js";

/**
 * Interface for binding to an identity.
 */
export interface IdentityBinder {
  bind(mountPath: string, runner: OperationFileRunner, timeoutMs: number): Promise<BindResult>;
  recheck(session: BoundSession, runner: OperationFileRunner, timeoutMs: number): Promise<RecheckResult>;
}

export interface BoundSession {
  principalId: PrincipalId;
  sessionId: string;
  publicKey: string;
  genesis: string | null;
  mountPath: string;
}

/**
 * Identity binder that calls identity_sled.get_own_identity.
 */
export class IdentityBinderImpl implements IdentityBinder {
  async bind(mountPath: string, runner: OperationFileRunner, timeoutMs: number): Promise<BindResult> {
    const result = await runner.run({
      plugin: "identity_sled",
      method: "get_own_identity",
      mountPath,
      identityFlag: "guest-kernel",
      inputBytes: new TextEncoder().encode("{}"),
      confirmSideEffects: false
    });

    if (!result.success) {
      return {
        ok: false,
        error: result.error,
        blocker: {
          id: "",
          at: "",
          branchDisplayName: "unknown",
          operation: "identity_sled.get_own_identity",
          caller: "unidentified",
          missing: result.error.failingItem,
          error: result.error.detail ?? result.error.failingItem,
          heldTasks: ["10.4"]
        }
      };
    }

    // Parse the result
    const parsed = JSON.parse(result.stdout);
    if (!parsed.success || !parsed.result) {
      return {
        ok: false,
        error: makeError("denial", "identity_sled.get_own_identity", "Identity not found", result.stderr),
        blocker: {
          id: "",
          at: "",
          branchDisplayName: "unknown",
          operation: "identity_sled.get_own_identity",
          caller: "unidentified",
          missing: "identity not found",
          error: result.stderr || "No identity",
          heldTasks: ["10.4"]
        }
      };
    }

    // Build BoundIdentityRecord
    const identity = parsed.result;
    const record: BoundIdentityRecord = {
      principalId: this.derivePrincipalId(identity) as PrincipalId,
      sessionId: identity.session_id,
      publicKey: identity.wireguard_pubkey,
      genesis: identity.genesis ?? null,
      fields: identity,
      receipt: {
        pluginId: "identity_sled",
        method: "get_own_identity",
        subid: identity.subid ?? "",
        operationId: parsed.operation_id,
        outcome: parsed.outcome ?? "success",
        success: parsed.success,
        eventId: parsed.event_id ?? 0,
        eventHash: parsed.event_hash ?? "",
        terminalEventId: parsed.terminal_event_id ?? 0,
        terminalEventHash: parsed.terminal_event_hash ?? ""
      }
    };

    return { ok: true, record, receipt: record.receipt };
  }

  async recheck(session: BoundSession, runner: OperationFileRunner, timeoutMs: number): Promise<RecheckResult> {
    const result = await runner.run({
      plugin: "identity_sled",
      method: "get_own_identity",
      mountPath: session.mountPath,
      identityFlag: "guest-kernel",
      inputBytes: new TextEncoder().encode("{}"),
      confirmSideEffects: false
    });

    if (!result.success) {
      return { equal: false, denialOrTimeout: result.error };
    }

    const parsed = JSON.parse(result.stdout);
    if (!parsed.success || !parsed.result) {
      return { equal: false, denialOrTimeout: makeError("denial", "identity_sled.get_own_identity", "Identity not found", result.stderr) };
    }

    const identity = parsed.result;

    // Compare fields
    const differing: string[] = [];
    if (identity.session_id !== session.sessionId) differing.push("session_id");
    if (identity.wireguard_pubkey !== session.publicKey) differing.push("publicKey");
    if ((identity.genesis ?? null) !== session.genesis) differing.push("genesis");

    return { equal: differing.length === 0, differingFields: differing };
  }

  /**
   * Derive principal id from identity (using genesis as proposed default D-25).
   */
  private derivePrincipalId(identity: any): string {
    // D-25 proposed default: use genesis
    if (identity.genesis) {
      return identity.genesis;
    }
    // Fallback to session_id
    return identity.session_id;
  }
}

export type BindResult =
  | { ok: true; record: BoundIdentityRecord; receipt: ReceiptSummary }
  | { ok: false; error: TypedError; blocker: { id: string; at: string; branchDisplayName: string; operation: string; caller: string; missing: string; error: string; heldTasks: string[] } };

export type RecheckResult =
  | { equal: true }
  | { equal: false; differingFields: string[] }
  | { equal: false; denialOrTimeout: TypedError };

export const identityBinder = new IdentityBinderImpl();

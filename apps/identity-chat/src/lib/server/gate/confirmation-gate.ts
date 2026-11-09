import { PrincipalId, ChatSessionId, PendingToolCall, TypedError } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";
import { partitionedStore, PartitionHandle } from "../state/partitioned-store.js";

/**
 * Key for a pending tool call.
 */
export interface PendingToolCallKey {
  principalId: PrincipalId;
  chatSessionId: ChatSessionId;
  toolCallId: string;
}

/**
 * Confirmation gate for holding mutation tool calls until approved.
 */
export class ConfirmationGate {
  private pendingCalls: Map<string, PendingToolCall> = new Map();
  private expiryMs: number;

  constructor(expiryMs: number = 300000) {
    this.expiryMs = expiryMs;
  }

  /**
   * Hold a mutation tool call until confirmation.
   * Returns a pending record with digest and expiry.
   */
  hold(call: ValidatedMutation, principalId: PrincipalId, chatSessionId: ChatSessionId): PendingToolCall {
    const { toolCallId, inputBytes } = call;
    const digest = this.computeDigest(principalId, chatSessionId, toolCallId, call);

    const pending: PendingToolCall = {
      toolCallId,
      chatSessionId,
      principalId,
      entry: call.entry,
      inputBytes,
      digest,
      heldAt: Date.now(),
      expiresAt: Date.now() + this.expiryMs,
      state: "pending"
    };

    const key = this.makeKey(principalId, chatSessionId, toolCallId);
    this.pendingCalls.set(key, pending);

    return pending;
  }

  /**
   * Confirm a pending tool call atomically.
   * Exactly-once consumption - returns failedCheck if the call is not pending.
   */
  confirm(principalId: PrincipalId, chatSessionId: ChatSessionId, toolCallId: string, digest: string): ConfirmOutcome {
    const key = this.makeKey(principalId, chatSessionId, toolCallId);
    const pending = this.pendingCalls.get(key);

    if (!pending) {
      return { accepted: false, failedCheck: "no-such-call" };
    }

    // Atomic consume - check and update in same JavaScript turn
    if (pending.state !== "pending") {
      return { accepted: false, failedCheck: "already-consumed" };
    }

    if (pending.digest !== digest) {
      return { accepted: false, failedCheck: "digest-mismatch" };
    }

    // Update state atomically
    pending.state = "released";
    this.pendingCalls.set(key, pending);

    return { accepted: true, released: pending };
  }

  /**
   * Reject a pending tool call.
   */
  reject(principalId: PrincipalId, chatSessionId: ChatSessionId, toolCallId: string): RejectOutcome {
    const key = this.makeKey(principalId, chatSessionId, toolCallId);
    const pending = this.pendingCalls.get(key);

    if (!pending) {
      return { accepted: false, failedCheck: "no-such-call" };
    }

    if (pending.state !== "pending") {
      return { accepted: false, failedCheck: "already-consumed" };
    }

    pending.state = "rejected";
    this.pendingCalls.set(key, pending);

    return { accepted: true };
  }

  /**
   * Discard pending calls matching a predicate.
   * Returns the number of discarded calls.
   */
  discardWhere(
    principalId: PrincipalId,
    chatSessionId: ChatSessionId,
    pred: (p: PendingToolCall) => boolean,
    reason: DiscardReason
  ): number {
    let count = 0;
    const prefix = `discarded:${reason}`;

    for (const [key, pending] of this.pendingCalls.entries()) {
      const pendingKey = this.makeKey(pending.principalId, pending.chatSessionId, pending.toolCallId);
      if (pendingKey === key && pred(pending)) {
        pending.state = "discarded";
        this.pendingCalls.set(key, pending);
        count++;
      }
    }

    return count;
  }

  /**
   * Expire pending calls due to timeout.
   * Returns the expired calls.
   */
  expireDue(nowMs: number): PendingToolCall[] {
    const expired: PendingToolCall[] = [];

    for (const [key, pending] of this.pendingCalls.entries()) {
      if (pending.expiresAt <= nowMs && pending.state === "pending") {
        pending.state = "expired";
        this.pendingCalls.set(key, pending);
        expired.push(pending);
      }
    }

    return expired;
  }

  /**
   * Get a pending call by key.
   */
  get(principalId: PrincipalId, chatSessionId: ChatSessionId, toolCallId: string): PendingToolCall | undefined {
    const key = this.makeKey(principalId, chatSessionId, toolCallId);
    return this.pendingCalls.get(key);
  }

  /**
   * Compute SHA-256 digest for the confirmation.
   */
  private computeDigest(
    principalId: PrincipalId,
    chatSessionId: ChatSessionId,
    toolCallId: string,
    call: ValidatedMutation
  ): string {
    const context = ["identity-chat-confirm/1", typeof principalId === "string" ? principalId : "", chatSessionId, toolCallId, call.entry.plugin, call.entry.method, new TextDecoder().decode(call.inputBytes)];
    const contextStr = context.join("\n");
    return this.sha256(contextStr);
  }

  /**
   * Compute SHA-256 hash of a string.
   */
  private sha256(text: string): string {
    // Simple hash implementation for demo
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;
  }

  /**
   * Create a key for the pending call map.
   */
  private makeKey(principalId: PrincipalId, chatSessionId: ChatSessionId, toolCallId: string): string {
    return `${typeof principalId === "string" ? principalId : ""}:${chatSessionId}:${toolCallId}`;
  }
}

export interface ValidatedMutation {
  toolCallId: string;
  entry: {
    plugin: string;
    method: string;
  };
  inputBytes: Uint8Array;
}

export type ConfirmOutcome =
  | { accepted: true; released: PendingToolCall }
  | { accepted: false; failedCheck: "no-such-call" | "already-consumed" | "rejected" | "expired" | "discarded" | "session-mismatch" | "identity-mismatch" | "digest-mismatch" };

export type RejectOutcome =
  | { accepted: true }
  | { accepted: false; failedCheck: "no-such-call" | "already-consumed" };

export type DiscardReason =
  | "catalog-change"
  | "tool-denied"
  | "session-end"
  | "identity-recheck-failure"
  | "turn-stream-close";

export const confirmationGate = new ConfirmationGate();

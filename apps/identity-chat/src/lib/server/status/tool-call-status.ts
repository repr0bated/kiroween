import { ToolCallStatus } from "../types.js";

/**
 * Tool Call Status Event types.
 */
export type ConfirmationEvent =
  | { type: "hold" }
  | { type: "release" }
  | { type: "reject" }
  | { type: "discard" }
  | { type: "catalog-change" }
  | { type: "tool-denied" }
  | { type: "session-end" }
  | { type: "receipt"; receipt: unknown }
  | { type: "read-back"; state: unknown }
  | { type: "denial"; error: string }
  | { type: "validation-failure"; error: string }
  | { type: "timeout" };

/**
 * Status state machine transition function.
 * Pure - no side effects, no model-text input.
 */
export function nextStatus(currentStatus: ToolCallStatus, event: ConfirmationEvent): ToolCallStatus {
  // Terminal states - no transition out
  const terminalStates: ToolCallStatus[] = ["completed", "rejected", "denied", "failed"];

  if (terminalStates.includes(currentStatus)) {
    return currentStatus;
  }

  // Current state machine logic
  switch (currentStatus) {
    case "awaiting_confirmation": {
      if (event.type === "release") {
        return "pending";
      }
      if (event.type === "reject" || event.type === "discard" || event.type === "timeout" || event.type === "session-end" || event.type === "catalog-change" || event.type === "tool-denied") {
        return "rejected";
      }
      return "awaiting_confirmation";
    }

    case "pending": {
      if (event.type === "receipt" && event.state) {
        return "completed";
      }
      if (event.type === "receipt" && !event.state) {
        return "unconfirmed";
      }
      if (event.type === "denial") {
        return "denied";
      }
      if (event.type === "validation-failure") {
        return "failed";
      }
      if (event.type === "timeout" || event.type === "session-end" || event.type === "catalog-change" || event.type === "tool-denied") {
        return "denied";
      }
      return "pending";
    }

    case "unknown": {
      if (event.type === "receipt" && event.state) {
        return "completed";
      }
      if (event.type === "receipt" && !event.state) {
        return "unconfirmed";
      }
      if (event.type === "denial") {
        return "denied";
      }
      if (event.type === "validation-failure") {
        return "failed";
      }
      if (event.type === "timeout" || event.type === "session-end" || event.type === "catalog-change" || event.type === "tool-denied") {
        return "failed";
      }
      return "unknown";
    }

    case "unconfirmed": {
      return "unconfirmed";
    }

    default:
      return currentStatus;
  }
}

/**
 * Check if a status is terminal (cannot transition out).
 */
export function isTerminal(status: ToolCallStatus): boolean {
  return ["completed", "rejected", "denied", "failed"].includes(status);
}

/**
 * Increment the sequence number for a toolCallId.
 */
export function incrementSeq(currentSeq: number): number {
  return currentSeq + 1;
}

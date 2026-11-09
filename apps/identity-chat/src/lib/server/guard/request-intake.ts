import { makeError } from "../errors/typed-error.js";
import { createSecretGuard } from "./secret-guard.js";

/**
 * Check a request object for credential material before processing.
 * Used for turn, decision, and re-verify requests.
 */
export function checkRequestIntake(data: unknown): { ok: true } | { ok: false; error: TypedError } {
  const guard = createSecretGuard();
  const jsonString = JSON.stringify(data);

  const result = guard.checkItem("request-intake", jsonString);
  if (!result.clean) {
    return { ok: false, error: makeError("validation", "request-intake", "Request contains credential material") };
  }

  return { ok: true };
}

/**
 * Validate and check a turn request.
 */
export function validateTurnRequest(data: unknown): { ok: true } | { ok: false; error: TypedError } {
  // Basic structure check
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: makeError("schema", "request", "Invalid request structure") };
  }

  const turnData = data as { id?: string; messages?: unknown[] };

  // Check for credential material
  const intakeResult = checkRequestIntake(turnData);
  if (!intakeResult.ok) {
    return intakeResult;
  }

  // Validate required fields
  if (!turnData.messages || !Array.isArray(turnData.messages)) {
    return { ok: false, error: makeError("schema", "messages", "Missing or invalid messages array") };
  }

  return { ok: true };
}

/**
 * Validate and check a decision request.
 */
export function validateDecisionRequest(data: unknown): { ok: true } | { ok: false; error: TypedError } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: makeError("schema", "request", "Invalid request structure") };
  }

  const decisionData = data as { type?: "approve" | "reject"; toolCallId?: string; digest?: string };

  // Check for credential material
  const intakeResult = checkRequestIntake(decisionData);
  if (!intakeResult.ok) {
    return intakeResult;
  }

  // Validate required fields
  if (!decisionData.type || !["approve", "reject"].includes(decisionData.type)) {
    return { ok: false, error: makeError("schema", "type", "Missing or invalid decision type") };
  }

  if (!decisionData.toolCallId || typeof decisionData.toolCallId !== "string") {
    return { ok: false, error: makeError("schema", "toolCallId", "Missing or invalid toolCallId") };
  }

  if (decisionData.type === "approve" && (!decisionData.digest || typeof decisionData.digest !== "string")) {
    return { ok: false, error: makeError("schema", "digest", "Missing or invalid digest for approve") };
  }

  return { ok: true };
}

/**
 * Validate and check a re-verify request.
 */
export function validateReverifyRequest(data: unknown): { ok: true } | { ok: false; error: TypedError } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: makeError("schema", "request", "Invalid request structure") };
  }

  const reverifyData = data as { type?: "reverify" };

  // Check for credential material
  const intakeResult = checkRequestIntake(reverifyData);
  if (!intakeResult.ok) {
    return intakeResult;
  }

  // Validate required fields
  if (!reverifyData.type || reverifyData.type !== "reverify") {
    return { ok: false, error: makeError("schema", "type", "Missing or invalid type for re-verify") };
  }

  return { ok: true };
}

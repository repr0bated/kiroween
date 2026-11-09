import { TypedError } from "./types.js";

export type ErrorKind = TypedError["kind"];

export function makeError(kind: ErrorKind, failingItem: string, nextStep: string, detail?: string): TypedError {
  return { kind, failingItem, nextStep, detail };
}

// Map of error kind to next step
export const ERROR_NEXT_STEPS: Record<ErrorKind, string> = {
  "missing-mount": "Check that the mount path is configured correctly in the Identity_Profile",
  "transport": "Check network connectivity and the Lungs_Socket connection",
  "provider": "Check the Model_Provider configuration and credentials",
  "schema": "Verify the tool argument matches the sealed method schema",
  "configuration": "Verify the Identity_Profile is valid and complete",
  "unknown-outcome": "Operation completed but outcome is unknown - review logs and receipts",
  "denial": "Check that the required capability is granted to this identity",
  "validation": "Fix the tool argument to match the schema requirements"
};

export function getNextStep(kind: ErrorKind): string {
  return ERROR_NEXT_STEPS[kind] ?? "Review the error details and take appropriate action";
}

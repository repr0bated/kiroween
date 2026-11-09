import { SecretGuard, StreamGuard } from "./stream-guard.js";
import { CredentialClass, OutputChannel, TypedError } from "../types.js";
import { makeError } from "../errors/typed-error.js";

export function createSecretGuard(): {
  guard: SecretGuard;
  checkItem: (channel: OutputChannel, item: string | Uint8Array) => { clean: true } | { clean: false; cls: CredentialClass };
  streamGuard: (channel: OutputChannel) => StreamGuard;
} {
  const guard = new SecretGuard(2000);

  return {
    guard,
    checkItem: (channel, item) => {
      const result = guard.checkItem(channel, item);
      if (result.clean) {
        return { clean: true };
      }
      return { clean: false, cls: result.cls };
    },
    streamGuard: (channel) => guard.streamGuard(channel)
  };
}

/**
 * Check input data for credential material before processing.
 */
export function checkIntake(data: unknown): TypedError | undefined {
  const guard = createSecretGuard();
  const jsonString = JSON.stringify(data);

  const verdict = guard.checkItem("request-intake", jsonString);
  if (!verdict.clean) {
    return makeError("validation", "request-intake", "Request contains credential material");
  }
  return undefined;
}

/**
 * Redact a typed error by replacing any credential material with a marker.
 */
export function redactError(error: TypedError): TypedError {
  const guard = createSecretGuard();

  if (error.detail) {
    const result = guard.checkItem("ui-stream", error.detail);
    if (!result.clean) {
      return { ...error, detail: "[redacted: credential material]" };
    }
  }

  if (error.failingItem) {
    const result = guard.checkItem("ui-stream", error.failingItem);
    if (!result.clean) {
      return { ...error, failingItem: "[redacted: credential material]" };
    }
  }

  return error;
}

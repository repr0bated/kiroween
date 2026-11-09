import { CredentialClass, SecurityEvent, TypedError } from "../types.js";
import { makeError, redactError } from "./secret-guard.js";
import { StreamGuard } from "./stream-guard.js";
import { createSecretGuard } from "./secret-guard.js";

export type OutputChannel = "model-context" | "ui-stream" | "log" | "telemetry" | "persisted-server" | "persisted-client" | "request-intake" | "partition";

export interface OutputWriter<T> {
  write(item: T): Promise<void>;
  close(): Promise<void>;
}

export class OutputGatingWriter<T> implements OutputWriter<T> {
  private writer: OutputWriter<T>;
  private streamGuard: StreamGuard;
  private channel: OutputChannel;
  private blocked: boolean;

  constructor(writer: OutputWriter<T>, channel: OutputChannel) {
    this.writer = writer;
    this.channel = channel;
    this.blocked = false;
    const guard = createSecretGuard();
    this.streamGuard = guard.streamGuard(channel);
  }

  async write(item: T): Promise<void> {
    if (this.blocked) {
      return;
    }

    const jsonString = JSON.stringify(item);
    const result = this.streamGuard.push(jsonString);

    if (!result.clean) {
      this.blocked = true;
      const error = makeError("validation", this.channel, "Output contains credential material");
      const redacted = redactError(error);
      await this.writer.write(redacted as unknown as T);
      await this.writer.close();
      return;
    }

    if (result.release) {
      await this.writer.write(JSON.parse(result.release) as T);
    }
  }

  async close(): Promise<void> {
    const result = this.streamGuard.end();
    if (!this.blocked && result.clean && result.release) {
      await this.writer.write(JSON.parse(result.release) as T);
    }
    await this.writer.close();
  }
}

/**
 * Create a writer that gates output and records security events on detection.
 */
export function createGatedWriter<T>(writer: OutputWriter<T>, channel: OutputChannel): OutputWriter<T> {
  return new OutputGatingWriter<T>(writer, channel);
}

/**
 * Create a redacting logger that filters credential material.
 */
export function createRedactingLogger(): (level: string, message: string, ...args: unknown[]) => void {
  const guard = createSecretGuard();

  return (level: string, message: string, ...args: unknown[]) => {
    const result = guard.checkItem("log", message);
    if (!result.clean) {
      console.log(`[${level}] [redacted: credential material]`);
    } else {
      console.log(`[${level}] ${message}`, ...args);
    }
  };
}

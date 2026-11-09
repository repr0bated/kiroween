import { CredentialRegistry, CredentialClass } from "./credential-registry.js";
import { OutputChannel } from "../types.js";

export interface GuardVerdict {
  clean: true;
} | {
  clean: false;
  cls: CredentialClass;
} | {
  error: "timeout" | "internal";
};

export class SecretGuard {
  private registry: CredentialRegistry;
  private checkTimeoutMs: number;

  constructor(timeoutMs: number = 2000) {
    this.registry = new CredentialRegistry();
    this.checkTimeoutMs = timeoutMs;
  }

  /**
   * Register a held credential value for a specific partition.
   */
  registerHeld(cls: CredentialClass, value: Uint8Array): void {
    this.registry.registerHeld(cls, value);
  }

  /**
   * Check a single item for credential material.
   */
  checkItem(channel: OutputChannel, item: string | Uint8Array): GuardVerdict {
    try {
      const credentialClass = this.registry.checkItem(item);
      if (credentialClass) {
        return { clean: false, cls: credentialClass };
      }
      return { clean: true };
    } catch (e) {
      return { error: "internal" };
    }
  }

  /**
   * Create a stream guard for chunked output.
   */
  streamGuard(channel: OutputChannel): StreamGuard {
    return new StreamGuard(this, channel, this.checkTimeoutMs);
  }

  /**
   * Check a string for credential material with timeout.
   */
  async checkWithTimeout(channel: OutputChannel, item: string): Promise<GuardVerdict> {
    try {
      const result = await Promise.race([
        Promise.resolve(this.checkItem(channel, item)),
        new Promise<GuardVerdict>(resolve => setTimeout(() => resolve({ error: "timeout" }), this.checkTimeoutMs))
      ]);
      return result;
    } catch (e) {
      return { error: "internal" };
    }
  }
}

export class StreamGuard {
  private guard: SecretGuard;
  private channel: OutputChannel;
  private timeoutMs: number;
  private heldBack: string;
  private holdBackLength: number;

  constructor(guard: SecretGuard, channel: OutputChannel, timeoutMs: number) {
    this.guard = guard;
    this.channel = channel;
    this.timeoutMs = timeoutMs;
    this.heldBack = "";
    this.holdBackLength = 15; // Longest 16-byte window prefix
  }

  /**
   * Push a chunk and release safe bytes.
   */
  push(chunk: string): GuardVerdict & { release: string } {
    const combined = this.heldBack + chunk;
    const verdict = this.guard.checkItem(this.channel, combined);

    if (verdict.clean) {
      // No credential material found - release everything except the last 15 bytes
      const releaseLength = combined.length - this.holdBackLength;
      if (releaseLength > 0) {
        this.heldBack = combined.slice(releaseLength);
        return { ...verdict, release: combined.slice(0, releaseLength) };
      }
      this.heldBack = combined;
      return { ...verdict, release: "" };
    } else {
      // Credential material found - block everything
      this.heldBack = "";
      return { ...verdict, release: "" };
    }
  }

  /**
   * End the stream and flush remaining bytes.
   */
  end(): GuardVerdict & { release: string } {
    if (this.heldBack.length === 0) {
      return { clean: true, release: "" };
    }

    const verdict = this.guard.checkItem(this.channel, this.heldBack);
    return { ...verdict, release: verdict.clean ? this.heldBack : "" };
  }
}

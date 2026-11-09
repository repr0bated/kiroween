import { SecurityEvent, CredentialClass } from "../types.js";

export class SecurityEventWriter {
  private events: SecurityEvent[] = [];

  /**
   * Record a security event.
   */
  record(options: {
    channel: SecurityEvent["channel"];
    credentialClass?: CredentialClass;
    chatSessionId?: string;
    branchDisplayName?: string;
    otherBranchDisplayName?: string;
  }): SecurityEvent {
    const event: SecurityEvent = {
      at: new Date().toISOString(),
      channel: options.channel,
      credentialClass: options.credentialClass,
      chatSessionId: options.chatSessionId,
      branchDisplayName: options.branchDisplayName,
      otherBranchDisplayName: options.otherBranchDisplayName
    };
    this.events.push(event);
    return event;
  }

  /**
   * Get all events.
   */
  getAll(): SecurityEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
  }
}

export const securityEventWriter = new SecurityEventWriter();

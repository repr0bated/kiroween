import { PrincipalId, ChatSessionId, BoundIdentityRecord, TypedError } from "../types.js";

/**
 * Opaque partition handle - only created by open().
 */
export interface PartitionHandle {
  readonly principalId: PrincipalId;
}

/**
 * State kinds for typed storage.
 */
export type StateKind = "chat-session" | "pending-call" | "blocker-record" | "security-event";

/**
 * State of different kinds.
 */
export type StateOf<K extends StateKind> =
  K extends "chat-session" ? ChatSession
  : K extends "pending-call" ? PendingToolCall
  : K extends "blocker-record" ? BlockerRecord
  : K extends "security-event" ? SecurityEvent
  : never;

/**
 * Partitioned store keyed by principal id.
 * Memory-only - restart drops everything.
 */
export class PartitionedStore {
  private partitions: Map<string, Map<string, unknown>> = new Map();

  /**
   * Open a partition for a principal id.
   * Returns an opaque handle.
   */
  open(principalId: PrincipalId): PartitionHandle {
    const idStr = typeof principalId === "string" ? principalId : (principalId as unknown as string);
    if (!this.partitions.has(idStr)) {
      this.partitions.set(idStr, new Map());
    }
    return { principalId } as PartitionHandle;
  }

  /**
   * Get a value from a partition.
   */
  get<K extends StateKind>(handle: PartitionHandle, kind: K, id: string): StateOf<K> | undefined {
    const idStr = typeof handle.principalId === "string" ? handle.principalId : (handle.principalId as unknown as string);
    const partition = this.partitions.get(idStr);
    if (!partition) {
      throw new PartitionError(`Partition not found for principalId: ${handle.principalId}`);
    }
    return partition.get(`${kind}:${id}`) as StateOf<K> | undefined;
  }

  /**
   * Put a value into a partition.
   */
  put<K extends StateKind>(handle: PartitionHandle, kind: K, id: string, value: StateOf<K>): void {
    const idStr = typeof handle.principalId === "string" ? handle.principalId : (handle.principalId as unknown as string);
    const partition = this.partitions.get(idStr);
    if (!partition) {
      throw new PartitionError(`Partition not found for principalId: ${handle.principalId}`);
    }
    partition.set(`${kind}:${id}`, value);
  }

  /**
   * Drop all entries for a specific chat session in a partition.
   */
  drop(handle: PartitionHandle, chatSessionId: ChatSessionId): void {
    const idStr = typeof handle.principalId === "string" ? handle.principalId : (handle.principalId as unknown as string);
    const partition = this.partitions.get(idStr);
    if (!partition) {
      throw new PartitionError(`Partition not found for principalId: ${handle.principalId}`);
    }

    // Remove all entries matching the chatSessionId prefix
    const prefix = `chat-session:${chatSessionId}`;
    for (const key of partition.keys()) {
      if (key.startsWith(prefix)) {
        partition.delete(key);
      }
    }
  }

  /**
   * Drop an entire partition.
   */
  dropPartition(handle: PartitionHandle): void {
    const idStr = typeof handle.principalId === "string" ? handle.principalId : (handle.principalId as unknown as string);
    this.partitions.delete(idStr);
  }

  /**
   * Check if a partition has an active session.
   */
  hasActiveSession(handle: PartitionHandle): boolean {
    const idStr = typeof handle.principalId === "string" ? handle.principalId : (handle.principalId as unknown as string);
    const partition = this.partitions.get(idStr);
    return partition !== undefined;
  }
}

/**
 * Error thrown when partition access fails.
 */
export class PartitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartitionError";
  }
}

/**
 * Global partitioned store instance.
 */
export const partitionedStore = new PartitionedStore();

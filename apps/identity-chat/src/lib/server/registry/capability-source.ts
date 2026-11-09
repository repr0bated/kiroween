import { HeldCapabilityResult } from "../types.js";
import { blockerRecordWriter } from "../records/blocker-records.js";

/**
 * Interface for getting held capabilities from a source.
 */
export interface HeldCapabilitySource {
  getCapabilities(): Promise<HeldCapabilityResult>;
}

/**
 * Interim capability source that returns undetermined result.
 * This is used until the real source is implemented (task 19.2).
 */
export class InterimHeldCapabilitySource implements HeldCapabilitySource {
  async getCapabilities(): Promise<HeldCapabilityResult> {
    // Record a blocker for the missing source
    blockerRecordWriter.create({
      branchDisplayName: "unknown",
      operation: "HeldCapabilitySource.getCapabilities",
      caller: "unidentified",
      missing: "source-unknown",
      error: "Held capability source not configured",
      heldTasks: ["6.1", "6.2"]
    });
    return { kind: "undetermined", reason: "source-unknown" };
  }
}

/**
 * Create an interim capability source.
 */
export function createInterimCapabilitySource(): HeldCapabilitySource {
  return new InterimHeldCapabilitySource();
}

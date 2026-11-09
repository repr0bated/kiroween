import { BlockerRecord } from "../types.js";

export class BlockerRecordWriter {
  private records: BlockerRecord[] = [];
  private nextId: number = 1;

  /**
   * Create a new blocker record and add it to the writer.
   */
  create(options: {
    branchDisplayName: string;
    operation: string;
    caller: string;
    missing: string;
    error: string;
    heldTasks: string[];
  }): BlockerRecord {
    const record: BlockerRecord = {
      id: `BR-${Date.now()}-${this.nextId++}`,
      at: new Date().toISOString(),
      branchDisplayName: options.branchDisplayName,
      operation: options.operation,
      caller: options.caller,
      missing: options.missing,
      error: options.error,
      heldTasks: options.heldTasks
    };
    this.records.push(record);
    return record;
  }

  /**
   * Get all records.
   */
  getAll(): BlockerRecord[] {
    return [...this.records];
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.records = [];
    this.nextId = 1;
  }
}

export const blockerRecordWriter = new BlockerRecordWriter();

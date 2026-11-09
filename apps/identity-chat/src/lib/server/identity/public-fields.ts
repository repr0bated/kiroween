import { BoundIdentityRecord, PublicIdentityFields } from "../types.js";

/**
 * Project public identity fields from BoundIdentityRecord.
 * Excludes declared-secret members.
 */
export function projectPublicFields(record: BoundIdentityRecord): PublicIdentityFields {
  return {
    principalId: typeof record.principalId === "string" ? record.principalId : "",
    sessionId: record.sessionId,
    publicKey: record.publicKey,
    genesis: record.genesis,
    displayName: record.fields.display_name as string ?? ""
  };
}

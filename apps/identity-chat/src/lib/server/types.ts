// Branded types for type safety
export type PrincipalId = string & { readonly __brand: "PrincipalId" };
export type ChatSessionId = string & { readonly __brand: "ChatSessionId" };
export type ToolKey = `${string}\u0000${string}`;
export type ViewKind = "3tched" | "threetched";
export type CatalogPin = { viewId: string; catalogHash: string; catalogGeneration: number };
export type DeploymentTargetKind = "identity_container" | "host_dashboard";

export interface RegistryEntry {
  toolName: string;
  plugin: string;
  method: string;
  viewKind: ViewKind;
  args: JsonValue;
  returns: JsonValue | null;
  requiredCapability: string | null;
  sideEffect: "read" | "mutation";
  idempotent: boolean;
  subid: string;
  status: { offered: true } | { offered: false; reason: "absent" | "undetermined"; detail: string };
}

export interface RegistrySnapshot {
  pin: CatalogPin;
  entries: ReadonlyMap<ToolKey, RegistryEntry>;
}

export type HeldCapabilityResult =
  | { kind: "set"; capabilities: ReadonlySet<string>; receipt: ReceiptSummary }
  | { kind: "undetermined"; reason: "denial" | "no-receipt" | "unparseable" | "source-unknown" };

export interface PendingToolCall {
  toolCallId: string;
  chatSessionId: ChatSessionId;
  principalId: PrincipalId;
  entry: RegistryEntry;
  inputBytes: Uint8Array;
  digest: string;
  heldAt: number;
  expiresAt: number;
  state: "pending" | "released" | "rejected" | "expired" | "discarded";
}

export type ToolCallStatus =
  | "awaiting_confirmation"
  | "pending"
  | "unknown"
  | "unconfirmed"
  | "completed"
  | "rejected"
  | "denied"
  | "failed";

export interface ToolCallStatusUpdate {
  toolCallId: string;
  status: ToolCallStatus;
  seq: number;
  plugin: string;
  method: string;
  requiredCapability: string | null;
  args?: JsonValue;
  digest?: string;
  receipt?: ReceiptSummary;
  authoritativeState?: JsonValue;
  readBackError?: TypedError;
  executionLink?: { executionId: string } | { unlinked: string };
  error?: TypedError;
}

export interface ReceiptSummary {
  pluginId: string;
  method: string;
  subid: string;
  operationId: string;
  outcome: string;
  success: boolean;
  eventId: number;
  eventHash: string;
  terminalEventId: number;
  terminalEventHash: string;
}

export interface BoundIdentityRecord {
  principalId: PrincipalId;
  sessionId: string;
  publicKey: string;
  genesis: string | null;
  fields: Readonly<Record<string, JsonValue>>;
  receipt: ReceiptSummary;
}

export interface PublicIdentityFields {
  principalId: string;
  sessionId: string;
  publicKey: string;
  genesis: string | null;
  displayName: string;
}

export interface ChatSession {
  key: { principalId: PrincipalId; chatSessionId: ChatSessionId };
  startedAt: string;
  deploymentTarget: DeploymentTargetKind;
  mountPaths: { "3tched": string; threetched: string };
  profile: IdentityProfile;
  sessionMode: "standard" | "control_plane" | "ui_build";
  toolCallLimit: number;
  identity: BoundIdentityRecord;
  catalogPins: { "3tched": CatalogPin | null; threetched": CatalogPin | null };
  registry: RegistrySnapshot;
  stickyDenied: Set<ToolKey>;
  state: "active" | "ended";
}

export interface IdentityProfile {
  format: "identity-chat-profile/1";
  principal_id: string;
  display_name: string;
  expected_session_id?: string;
  session_mode?: string;
  deployment_targets: {
    kind: "identity_container" | "host_dashboard";
    mount_paths: { "3tched": string; threetched": string };
  }[];
}

export type ErrorKind =
  | "missing-mount"
  | "transport"
  | "provider"
  | "schema"
  | "configuration"
  | "unknown-outcome"
  | "denial"
  | "validation";

export interface TypedError {
  kind: ErrorKind;
  failingItem: string;
  nextStep: string;
  detail?: string;
}

export interface BlockerRecord {
  id: string;
  at: string;
  branchDisplayName: string;
  operation: string;
  caller: string;
  missing: string;
  error: string;
  heldTasks: string[];
}

export interface SecurityEvent {
  at: string;
  channel: OutputChannel;
  credentialClass?: CredentialClass;
  chatSessionId?: string;
  branchDisplayName?: string;
  otherBranchDisplayName?: string;
}

export type CredentialClass =
  | "sid1"
  | "oia1"
  | "provider-credential"
  | "identity-key"
  | "w3-key"
  | "declared-secret-field";

export type OutputChannel =
  | "model-context"
  | "ui-stream"
  | "log"
  | "telemetry"
  | "persisted-server"
  | "persisted-client"
  | "request-intake"
  | "partition";

export interface ExecutionRecordView {
  id: string;
  prevHash: string;
  execHash: string;
  toolName?: string;
  integrity?: boolean;
}

// Helper type for JSON values
export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

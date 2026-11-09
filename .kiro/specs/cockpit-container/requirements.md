# Requirements Document

## Introduction

This spec covers the Kiroween 2026 hackathon work in the separate 3tchedW3
repository (`/srv/git/kiroween`). The goal is a root/cockpit container for the
3tchedW3 control-plane chatbot. The 3tchedW3 Web3 identity binds the cockpit and
acts as its root of trust. It is layered on the existing identity-bound
container architecture running on the existing VPS backend.

3tchedW3 mirrors the sealed 3tched identity as a self-contained, sealed
identity that is not tied to any hardware. The sealed identity stays
authoritative. The Web3 side is a verifiable mirror and attestation and never a
second source of truth.

op-dbus (`/srv/git/odbus-verified`), 3tchedFS, `identity_sled`, the
identity-bound container architecture and the external host provisioner
`op-identity-root` pre-date the hackathon. They are pinned dependencies: this
work reads them, calls them through their existing interfaces, and never
modifies or copies them. All hackathon code lives in this repository and stays
separable from pre-existing code.

Every requirement is subject to `.kiro/steering/security-boundaries.md`. Where
this document and the steering file differ, the steering file wins.

The chat interface is specified in the separate, identity-neutral spec
`.kiro/specs/identity-chat-interface/` (one interface for all Branches); the
3tchedW3 Cockpit is one deployment of it, and in this spec Chatbot_Glue covers
only the cockpit's operation-file wiring to op-dbus.

### Discovery findings at spec time (2026-11-08, read-only)

These findings guide the requirements. The implementation must re-verify each
one and record the result (Requirements 1 and 2); they are not accepted as
current facts without re-verification.

- Baseline repository `/srv/git/odbus-verified`, branch `main`, HEAD
  `154a1b9db3443dc87bc5d078bd70f4b06674c65c` (2026-11-04), 36 commits ahead of
  origin, with a heavily modified and partly untracked working tree. Last
  commit before the submission window: `380f692dceb6a73b2a5e6567dbd5955ce99786dd`
  (2026-10-29).
- The `identity_sled` schema (`crates/op-plugins/src/state_plugins/identity_sled.rs`)
  exposes `prepare_container`, `provision_container`, `touch_session`,
  `get_own_identity` and other methods. `rename_container` exists only in the
  working tree, not at HEAD.
- `prepare_container` is restricted to the configured control-plane chatbot
  key and session (`OP_CONTROL_PLANE_CHATBOT_*`; session
  `b0c777e3-0955-cd8b-3d01-ca12998cae28`, which belongs to the main 3tched
  identity). Clean-plan validation requires the native name to equal one of
  the main 3tched reserved names. Seed validation requires the target key to be
  an active registered human principal. As a result, the existing creation
  contract appears unable to provision a second (3tchedW3) cockpit without a
  change to pinned code or to the configured control-plane identity. Both
  changes are forbidden. This is an expected blocker.
- The external host provisioner `deploy/runit/libexec-3tched/op-identity-root`
  (committed, sha256 prefix `a096829814a9205a`) provides the one-time
  `seed-create` and lifecycle subcommands.
- Session and principal ids are BLAKE3 KDF derivations of the WireGuard public
  key (`crates/op-identity/src/session.rs`); no hardware identifier is used.
  `sealed_id.rs` defines the SID1 envelope. The audit hash chain is
  `crates/op-execution-tracker/src/record.rs` (`prev_hash`, `hash_execution`).
- No 3tchedFS mount exists for the current user (`/run/mounts/3tchedFS`
  absent), and `/run/opdbus/lungs` contains no `lungs.sock`. No assigned
  3tchedW3 identity mount exists to act through. This is an expected blocker.
- No 3tchedW3 identity, on-chain counterpart, hackathon-era 3tchedW3 cockpit or
  Solidity contract was found. The Incus instance `CockpitBot3tched` belongs to
  the main 3tched identity.
- No in-container egress path exists. The lungs socket is the only permitted
  host channel; the `egress-socket` profile and HTTP proxy routes are
  forbidden for 3tched containers.
- The public repository `/srv/git/3tched-in-Schema` describes receipts feeding
  a Web3 index and a Merkle root anchored on-chain, with on-chain verification
  documented as procedure-only and not deployed.
- Owner correction (2026-11-08): "do not use tched_router, we may have to fix
  that in source code — supposed to be threetched". The pinned baseline's
  `deploy/workspace-image/README.md` verifies the `/run/mounts/threetched`
  view with `3tched-fs call tched_router GetState --mount
  /run/mounts/threetched --guest-kernel`, and the baseline still names the
  plugin and runit service `tched_router` / `tched-router`. The correct
  surface name is `threetched`. `tched_router` is a naming defect in the
  pinned op-dbus source. Any source fix belongs in `/srv/git/odbus-verified`,
  outside this repository, and needs separate Owner_Authorization
  (Requirement 25).

## Glossary

- **3tched_Identity**: The main, pre-existing sealed 3tched identity. It owns the
  control-plane chatbot session `b0c777e3-0955-cd8b-3d01-ca12998cae28` and the
  names in Reserved_Main_Names.
- **3tchedW3_Identity**: The new hackathon identity that mirrors the 3tched
  identity model as a self-contained, sealed identity bound to the cockpit.
- **Sealed_Identity**: The authoritative identity state held by op-dbus and
  `identity_sled` (principal, session, public key, genesis, grants, receipts).
- **SID1**: The sealed identity credential envelope defined in
  `crates/op-identity/src/sealed_id.rs`. SID1 bytes are secret credential
  material.
- **Receipt**: The completed, attributed result record that an op-dbus
  operation returns through 3tchedFS.
- **Audit_Chain**: The existing execution hash chain (`ExecutionRecord.prev_hash`
  and `hash_execution`) in `op-execution-tracker`.
- **Authoritative_State**: State read back from the owning op-dbus plugin
  through a granted 3tchedFS read, as opposed to a local file or chain record.
- **Web3_Mirror**: The hackathon component that publishes a verifiable
  attestation of the 3tchedW3_Identity and derived audit data to a chain.
- **Attestation**: A record derived deterministically from Receipts, the
  Audit_Chain and public identity fields, suitable for chain anchoring.
- **Attestation_Deriver**: The hackathon function that computes Attestations,
  audit roots and Receipt digests from their source records.
- **Attestation_Codec**: The hackathon encoder and decoder for the canonical
  byte form of an Attestation.
- **Anchored_Data**: Data published to a chain: identity Attestation, Audit_Chain
  roots and Receipt digests.
- **Chain_Submitter**: The hackathon component that sends Anchored_Data to the
  chain through the Egress_Path.
- **Egress_Path**: An existing outbound-only network path, named explicitly in
  `design.md`, through which chain traffic leaves the system.
- **Testnet_Allowlist**: The set of testnet chain identifiers named in
  `design.md` as permitted targets.
- **W3_Key**: Signing key material belonging to the 3tchedW3_Identity.
- **Hardware_Identifier**: Any value derived from a specific machine, such as
  machine-id, DMI/SMBIOS data, MAC address, disk serial, TPM endorsement key,
  CPU id, hostname or Incus `volatile.uuid` used as a binding input.
- **Cockpit**: The identity-scoped Incus container that runs the 3tchedW3
  control-plane chatbot. "Root/cockpit" names its control-plane role only.
- **Hackathon_Cockpit**: A Cockpit for the 3tchedW3_Identity created on or
  after 2026-10-30.
- **Cockpit_Reservation**: The hackathon record that reserves a native
  container name and session for the 3tchedW3 Cockpit.
- **Reserved_Main_Names**: The names `3tchedChatbot`, `3tchedCockpitBot`,
  `3tchedCtlChatbot` and `CockpitBot3tched`, all belonging to the 3tched_Identity.
- **Main_Session**: The session `b0c777e3-0955-cd8b-3d01-ca12998cae28`.
- **Provisioning_Procedure**: The hackathon procedure that creates the
  Hackathon_Cockpit by calling the Creation_Contract and the External_Provisioner.
- **Creation_Contract**: The existing `identity_sled` creation methods
  (`prepare_container`, `provision_container` and related preflight methods)
  as implemented at the pinned baseline.
- **External_Provisioner**: The existing host tool `op-identity-root`, the only
  authorized party that may add a blank Leaf.
- **Seed**: The immutable, read-only shared Btrfs base image.
- **Leaf**: The identity-specific writable Btrfs device added onto the Seed.
- **Seven_Subvolumes**: The Btrfs sibling subvolumes `@`, `@agent_memory`,
  `@agent_rules`, `@agent_shared`, `@agent_skills`, `@agent_soul` and `@agent_user`.
- **Lifecycle_Operation**: Login, start, stop, restart, logout, recovery or
  failed-start cleanup of a Cockpit.
- **Lungs_Socket**: `/run/opdbus/lungs/lungs.sock`, the container's only host
  channel, shared read-only by directory and reached in the guest as
  `/run/3tched-lungs.socket`.
- **3tchedFS_Views**: The two guest filesystem views `/run/mounts/3tchedFS` and
  `/run/mounts/threetched`, with their sealed catalog and identity enforcement.
- **Threetched_Surface**: The `threetched` external surface exposed in
  `/run/mounts/threetched`. `tched_router` / `tched-router` is a deprecated
  baseline name for this surface that hackathon code must not use.
- **Operation_File**: A mounted 3tchedFS operation path of the form
  `operations/<plugin>/<method>/call` in the assigned identity's namespace.
- **Chatbot_Glue**: The hackathon code that connects the 3tchedW3 chatbot to
  op-dbus operations.
- **Denial**: Any refusal, missing grant, missing native owner, unsupported
  method, missing mount or unknown outcome returned or observed while acting.
- **Blocker_Record**: A recorded Denial with operation, caller, missing
  capability or policy, error text and timestamp.
- **Owner_Authorization**: An explicit, recorded authorization from the owner
  for a named live-system change.
- **Live_Change**: Any change to live identities, grants, storage, deployments,
  services, containers or chain state.
- **Baseline_Record**: The hackathon document recording the pinned
  pre-existing implementation.
- **Runtime_Record**: The hackathon document recording observed runtime state.
- **Provenance_Record**: `PROVENANCE.md` at the repository root.
- **Status_Report**: A report that states proposed, implemented, built, tested
  and deployed status separately.
- **Hackathon_Repository**: `/srv/git/kiroween`, the 3tchedW3 repository.
- **Implementer**: The Kiro agent or engineer carrying out the spec tasks.
- **Submission_Window**: The hackathon period that opened on 2026-10-30.

## Requirements

### Requirement 1: Baseline discovery record

**User Story:** As the owner, I want a record of the pre-existing identity,
lifecycle and provisioning implementation, so that hackathon work cites it as a
dependency and does not rely on historical documentation.

#### Acceptance Criteria

1. THE Implementer SHALL produce a Baseline_Record in the Hackathon_Repository that lists, for each pre-existing component used, its path in `/srv/git/odbus-verified`, the commit hash it is pinned to and its sha256 digest.
2. THE Baseline_Record SHALL cover the `identity_sled` schema and dispatch, identity binding and session derivation, the Creation_Contract, the External_Provisioner, `op-identity-image`, the Audit_Chain and the existing main 3tched cockpit reservation.
3. THE Baseline_Record SHALL mark each cited item as committed at the pinned HEAD, committed before the Submission_Window, or present only as uncommitted working-tree state.
4. THE Baseline_Record SHALL list, for each cited method or function, the current callers traced in source.
5. WHERE a documented behaviour differs from the traced implementation, THE Baseline_Record SHALL record the documented claim, the implemented behaviour and the source location of each.
6. THE Baseline_Record SHALL record every restriction in the Creation_Contract that names a specific key, session, native name or principal type.
7. THE Implementer SHALL perform baseline discovery using read-only operations on `/srv/git/odbus-verified`.
8. THE Baseline_Record SHALL include the Threetched_Surface naming discrepancy listing required by Requirement 25.

### Requirement 2: Runtime discovery record

**User Story:** As the owner, I want a record of what actually exists at
runtime, so that source definitions are not mistaken for deployment.

#### Acceptance Criteria

1. THE Implementer SHALL begin runtime discovery at the assigned identity's mounted 3tchedFS namespace and record the mount path, catalog hash, generation and discovered Operation_File schemas.
2. IF the assigned identity's 3tchedFS namespace is not mounted, THEN THE Implementer SHALL create a Blocker_Record naming the missing mount path and the missing Lungs_Socket state.
3. THE Runtime_Record SHALL state, with the evidence observed, whether a 3tchedW3_Identity exists, whether an on-chain counterpart exists and whether a Hackathon_Cockpit exists.
4. THE Runtime_Record SHALL classify each finding as observed runtime state, source definition only, or not found.
5. WHEN a contract or method is found only in source, THE Runtime_Record SHALL classify the contract or method as not deployed until a Receipt or chain query proves deployment.
6. THE Runtime_Record SHALL list each existing Incus instance with the session it carries and SHALL mark each instance as not belonging to the 3tchedW3_Identity unless its session matches the 3tchedW3_Identity session.
7. THE Implementer SHALL perform runtime discovery using read-only operations.

### Requirement 3: Preserve main 3tched names

**User Story:** As the owner, I want the main 3tched identity's cockpit names and
session left alone, so that hackathon work never takes over another identity.

#### Acceptance Criteria

1. WHEN a Cockpit_Reservation is validated, THE Cockpit_Reservation validator SHALL reject any native name equal to a Reserved_Main_Names entry, compared case-insensitively.
2. WHEN a Cockpit_Reservation is validated, THE Cockpit_Reservation validator SHALL reject a session equal to the Main_Session.
3. IF any hackathon procedure targets an instance named in Reserved_Main_Names or carrying the Main_Session, THEN THE procedure SHALL stop before acting and create a Blocker_Record.
4. THE Hackathon_Repository SHALL describe Reserved_Main_Names and the Main_Session only as excluded identifiers of the 3tched_Identity.

### Requirement 4: 3tchedW3 identity mirror and attestation

**User Story:** As a verifier, I want the Web3 side to be a verifiable mirror of
the sealed identity, so that I can check the cockpit's identity without the
chain becoming a second source of truth.

#### Acceptance Criteria

1. THE Web3_Mirror SHALL derive every published identity field from the Sealed_Identity of the 3tchedW3_Identity read through a granted 3tchedFS operation.
2. IF the Web3_Mirror's published state differs from the Sealed_Identity, THEN THE Web3_Mirror SHALL report the Sealed_Identity as authoritative and mark the published state as stale.
3. THE Web3_Mirror SHALL limit its effects on the Sealed_Identity, grants and Receipts to read operations.
4. FOR ALL pairs of Sealed_Identity and published mirror state, THE result reported by the Web3_Mirror SHALL equal the Sealed_Identity value (mirror never overrides sealed state).
5. THE Web3_Mirror SHALL provide a verification procedure that, given an Attestation and the corresponding public Sealed_Identity fields, reports match or mismatch.

### Requirement 5: Hardware-independent binding

**User Story:** As the owner, I want the 3tchedW3 binding to be free of host and
hardware identifiers, so that the identity is portable and self-contained.

#### Acceptance Criteria

1. THE Attestation_Deriver SHALL accept as binding inputs only the public key, principal id, session id, genesis, catalog hash, Receipt digests and Audit_Chain hashes.
2. IF a binding input contains a Hardware_Identifier, THEN THE Attestation_Deriver SHALL reject the input with an error naming the field.
3. FOR ALL valid binding inputs, THE Attestation produced on one host SHALL equal the Attestation produced from the same inputs on any other host.

### Requirement 6: Derived anchoring without SID1 exposure

**User Story:** As a verifier, I want chain-anchored data derived from existing
receipts and the audit chain, so that the chain attests history without
replacing or exposing it.

#### Acceptance Criteria

1. THE Attestation_Deriver SHALL compute Anchored_Data only from existing Receipts, the Audit_Chain and public Sealed_Identity fields.
2. FOR ALL source inputs, THE Attestation_Deriver SHALL produce identical output when invoked repeatedly on the same inputs (deterministic derivation).
3. FOR ALL source inputs, THE Attestation_Deriver output SHALL contain no SID1 envelope, no SID1 substring of 16 or more bytes and no hash computed over SID1 bytes.
4. IF an input to the Attestation_Deriver contains SID1 bytes, THEN THE Attestation_Deriver SHALL reject the input with an error that omits the SID1 bytes.
5. WHEN any single Receipt in a derivation input changes, THE Attestation_Deriver SHALL produce a different audit root.
6. FOR ALL Receipts included in an audit root, THE inclusion proof produced by the Attestation_Deriver SHALL verify against that audit root.
7. IF an Audit_Chain segment has a `prev_hash` that does not match the preceding record hash, THEN THE Attestation_Deriver SHALL reject the segment and report the first mismatching position.
8. THE Chain_Submitter SHALL publish Anchored_Data in addition to Receipts and the Audit_Chain, leaving both source records unchanged.

### Requirement 7: Attestation encoding

**User Story:** As a verifier, I want a canonical byte form for attestations, so
that independent parties compute the same digest.

#### Acceptance Criteria

1. THE Attestation_Codec SHALL encode an Attestation into the canonical byte form specified in `design.md`.
2. WHEN valid canonical bytes are provided, THE Attestation_Codec SHALL decode them into an Attestation.
3. IF malformed or non-canonical bytes are provided, THEN THE Attestation_Codec SHALL return an error identifying the failing field or offset.
4. FOR ALL valid Attestations, decoding the encoded bytes and encoding again SHALL produce identical bytes (round-trip property).

### Requirement 8: Key custody

**User Story:** As the owner, I want 3tchedW3 key material to stay sealed inside
its identity, so that no host, log or repository holds a usable key.

#### Acceptance Criteria

1. THE W3_Key SHALL be generated and held only inside the sealed storage of the 3tchedW3_Identity.
2. WHEN a chain signature is required, THE Chain_Submitter SHALL obtain the signature from an operation executed inside the 3tchedW3_Identity and receive only the signature and public key.
3. THE Hackathon_Repository SHALL contain no private key, seed phrase, SID1 credential or other credential material.
4. WHEN the Chain_Submitter or Chatbot_Glue writes a log entry, THE component SHALL redact private key bytes, seed phrases and SID1 bytes before writing.
5. THE Implementer SHALL provide a repository check that reports any file matching private key, seed phrase or SID1 patterns.

### Requirement 9: Explicit chain decisions

**User Story:** As the owner, I want chain, network and contract choices recorded
as explicit decisions, so that they are reviewed rather than assumed.

#### Acceptance Criteria

1. THE `design.md` document SHALL name the selected chain, network, Testnet_Allowlist, contract or standard, and canonical encoding, each with the alternatives considered and the reason for selection.
2. THE `design.md` document SHALL name the Egress_Path used for chain traffic and cite its pre-existing owner.
3. WHILE a chain, network, contract or Egress_Path decision is absent from `design.md`, THE Implementer SHALL leave the dependent tasks in proposed status.

### Requirement 10: Testnet-only gating

**User Story:** As the owner, I want chain activity limited to testnets, so that
no funds are spent without my separate authorization.

#### Acceptance Criteria

1. WHEN a chain submission is requested, THE Chain_Submitter SHALL verify that the target chain identifier is in the Testnet_Allowlist before signing.
2. IF the target chain identifier is not in the Testnet_Allowlist, THEN THE Chain_Submitter SHALL refuse the submission and create a Blocker_Record.
3. IF a submission requires a signed transaction from a funded key, a mainnet deployment or a token spend, THEN THE Chain_Submitter SHALL refuse the submission unless an Owner_Authorization names that specific action.

### Requirement 11: Outbound-only egress through a named existing path

**User Story:** As the owner, I want chain traffic to use an existing outbound
path, so that the cockpit gains no new network door.

#### Acceptance Criteria

1. THE Chain_Submitter SHALL send chain traffic only through the Egress_Path named in `design.md`.
2. THE Chain_Submitter SHALL initiate outbound connections only and SHALL open no listening socket.
3. IF no existing Egress_Path is available, THEN THE Implementer SHALL create a Blocker_Record and leave chain submission in proposed status.
4. THE Provisioning_Procedure SHALL attach no Incus proxy device, `egress-socket` profile, HTTP proxy setting or host socket other than the Lungs_Socket directory to the Cockpit.

### Requirement 12: 3tchedW3 cockpit reservation

**User Story:** As the owner, I want a distinct reservation for the 3tchedW3
cockpit, so that it never collides with the main 3tched cockpit.

#### Acceptance Criteria

1. THE Cockpit_Reservation SHALL record a native container name, the 3tchedW3_Identity session id, the principal id and the public key fingerprint.
2. THE Cockpit_Reservation SHALL derive its session id and principal id from the 3tchedW3_Identity public key using the existing derivation in `crates/op-identity/src/session.rs`, called through its existing interface.
3. FOR ALL candidate reservations, THE Cockpit_Reservation validator SHALL accept a reservation only when its name is outside Reserved_Main_Names and its session differs from the Main_Session.
4. THE Cockpit_Reservation SHALL be stored in the Hackathon_Repository and SHALL be applied to the live system only through the Creation_Contract.

### Requirement 13: Provisioning through existing contracts

**User Story:** As the owner, I want the cockpit created through the existing
creation contract and external provisioner, so that the identity-bound container
architecture stays the single implementation.

#### Acceptance Criteria

1. THE Provisioning_Procedure SHALL invoke the Creation_Contract through Operation_Files of the 3tchedW3_Identity's mounted 3tchedFS namespace.
2. THE Provisioning_Procedure SHALL invoke the External_Provisioner `seed-create` subcommand only once, during explicit creation of the Hackathon_Cockpit.
3. THE Hackathon_Repository SHALL reference the Creation_Contract and External_Provisioner by path and pinned commit and SHALL contain no copy of their source.
4. WHEN the Provisioning_Procedure runs, THE Provisioning_Procedure SHALL first run the existing preflight methods (`inspect_provision_preflight` and `op-identity-root seed-preflight`) and record their Receipts.
5. IF the Creation_Contract restricts `prepare_container` or clean-plan validation to the 3tched_Identity key, the Main_Session or Reserved_Main_Names, THEN THE Provisioning_Procedure SHALL stop and create a Blocker_Record for owner escalation.
6. IF the Creation_Contract requires the target key to be an active registered human principal and the 3tchedW3_Identity key does not qualify, THEN THE Provisioning_Procedure SHALL stop and create a Blocker_Record for owner escalation.
7. THE Provisioning_Procedure SHALL create the Cockpit as unprivileged, non-nesting, non-autostart and session-bound, with the Btrfs-ioctl deny seccomp policy required by the External_Provisioner.

### Requirement 14: Storage and lifecycle preservation

**User Story:** As the owner, I want the seed, leaf and subvolume layout
preserved, so that the cockpit uses the same storage model as every identity.

#### Acceptance Criteria

1. THE Provisioning_Procedure SHALL leave the Seed read-only and unchanged.
2. THE Provisioning_Procedure SHALL verify that the Hackathon_Cockpit storage contains exactly the Seven_Subvolumes after creation.
3. WHEN a Lifecycle_Operation runs on the Hackathon_Cockpit, THE Lifecycle_Operation SHALL leave the set of Btrfs member devices identical to the set before the operation.
4. WHEN the Hackathon_Cockpit starts, THE Chatbot_Glue SHALL start the Cockpit through the existing `identity_sled.touch_session` method.
5. THE Hackathon_Repository SHALL contain no command that adds or removes a Btrfs device outside the single External_Provisioner `seed-create` call.

### Requirement 15: Existing cockpit preservation

**User Story:** As the owner, I want an existing hackathon cockpit kept intact,
so that no duplicate or reimaged cockpit replaces it.

#### Acceptance Criteria

1. IF the Runtime_Record shows an existing Hackathon_Cockpit, THEN THE Provisioning_Procedure SHALL skip creation and retain its identity, native UUID, credentials, grants and storage.
2. WHEN the Provisioning_Procedure is invoked for a Cockpit_Reservation whose session already has a Hackathon_Cockpit, THE Provisioning_Procedure SHALL report the existing Cockpit and perform no create, reimage or reseed action.
3. FOR ALL repeated invocations of the Provisioning_Procedure with the same Cockpit_Reservation, THE resulting set of Cockpits SHALL equal the set after the first successful invocation (idempotence).

### Requirement 16: Denial handling and escalation

**User Story:** As the owner, I want denials recorded and escalated, so that
permission boundaries are respected rather than bypassed.

#### Acceptance Criteria

1. WHEN a Denial occurs, THE Implementer SHALL create a Blocker_Record containing the operation, caller identity, missing capability or policy, error text and timestamp.
2. WHEN a Denial occurs, THE Implementer SHALL stop the dependent task and report the Blocker_Record to the owner.
3. IF a Denial occurs, THEN THE Implementer SHALL leave the denied action unperformed by any other route, including direct database edits, alternate transports, another identity, raw Incus commands and the chain.
4. IF an operation outcome is unknown, THEN THE Implementer SHALL record the outcome as unknown and repeat only the identical input to reconcile the outcome.
5. THE Runtime_Record SHALL include Blocker_Records for the `prepare_container` restriction and the missing 3tchedW3 identity mount when re-verification confirms them.

### Requirement 17: Verification through receipts and authoritative state

**User Story:** As the owner, I want completion proven by receipts and
authoritative state, so that a local write is never reported as success.

#### Acceptance Criteria

1. WHEN an operation is reported complete, THE Implementer SHALL attach the operation Receipt and the Authoritative_State read back after the operation.
2. IF a Receipt is missing or the Authoritative_State does not reflect the operation, THEN THE Implementer SHALL report the operation as incomplete.
3. WHEN the Hackathon_Cockpit has started, THE Implementer SHALL verify both 3tchedFS_Views through `3tched-fs describe --guest-kernel`, distinct kernel mount sources, the same catalog hash and generation, and one granted read per view with its attributed Receipt (see Requirement 25 for the threetched view).

### Requirement 18: Chatbot glue through operation files

**User Story:** As the chatbot operator, I want the 3tchedW3 chatbot to act only
through its own identity's operation files, so that every action is
identity-bound and granted.

#### Acceptance Criteria

1. THE Chatbot_Glue SHALL invoke op-dbus operations only by writing to Operation_Files in the 3tchedW3_Identity's mounted 3tchedFS_Views.
2. THE Chatbot_Glue SHALL discover method arguments, results and errors from the mounted Operation_File schemas at runtime.
3. THE Chatbot_Glue SHALL use the kernel-bound caller identity of the Cockpit and SHALL pass no SID1 file and no `--lungs-session` value.
4. THE Chatbot_Glue SHALL hold only the grants already assigned to the 3tchedW3_Identity.

### Requirement 19: No MCP, control plane or inbound door

**User Story:** As the owner, I want the product surface unchanged, so that the
hackathon adds no new attack surface.

#### Acceptance Criteria

1. THE Hackathon_Repository product code SHALL contain no MCP server, MCP client or MCP transport.
2. THE Chatbot_Glue SHALL use the existing op-dbus operations as the only control plane.
3. THE Cockpit SHALL expose no listening network port and SHALL reach the host only through the Lungs_Socket.
4. THE Provisioning_Procedure SHALL preserve both 3tchedFS_Views with their sealed catalog pin and identity enforcement.

### Requirement 20: Live-change authorization gate

**User Story:** As the owner, I want every live change to need my explicit
authorization, so that discovery and source work cannot alter the running
system.

#### Acceptance Criteria

1. WHEN a task would perform a Live_Change, THE Implementer SHALL check for an Owner_Authorization naming that change before acting.
2. IF no Owner_Authorization names the Live_Change, THEN THE Implementer SHALL produce the planned commands and expected Receipts and leave the task in proposed status.
3. THE Implementer SHALL limit work without Owner_Authorization to read-only discovery and reversible source changes in the Hackathon_Repository.
4. THE Implementer SHALL leave `/srv/git/odbus-verified` and `.kiro/steering/security-boundaries.md` unmodified.

### Requirement 21: Build and check policy

**User Story:** As the owner, I want builds and checks scoped and on request, so
that the shared host is not disrupted.

#### Acceptance Criteria

1. WHEN a build is required, THE Implementer SHALL build only the required scoped target for `x86_64-unknown-linux-gnu`.
2. THE Implementer SHALL run tests, Clippy, formatting checks and smoke fixtures only on explicit owner request.
3. THE Implementer SHALL run workspace-wide Cargo commands only on an explicit workspace request.
4. WHILE one Cargo process is running, THE Implementer SHALL start no other Cargo process.

### Requirement 22: Separate status reporting

**User Story:** As the owner, I want status reported by stage, so that proposed
work is never mistaken for deployed work.

#### Acceptance Criteria

1. THE Status_Report SHALL state proposed, implemented, built, tested and deployed status as separate fields for each component.
2. WHEN a component is reported deployed, THE Status_Report SHALL cite the deployment Receipt and the Authoritative_State evidence.
3. WHEN a component is reported tested, THE Status_Report SHALL cite the explicit owner request and the test command output.

### Requirement 23: Provenance record

**User Story:** As a judge, I want a provenance record, so that I can separate
pre-existing components from hackathon work.

#### Acceptance Criteria

1. THE Provenance_Record SHALL list each pre-existing component used (op-dbus crates and modules, the 3tchedFS operation contract, `identity_sled`, the External_Provisioner and `op-identity-image`) with its path and pinned commit or version.
2. THE Provenance_Record SHALL mark each pre-existing component as committed at the pin or uncommitted working-tree state.
3. THE Provenance_Record SHALL list each new Kiroween component (Web3_Mirror, Attestation_Deriver, contracts, Provisioning_Procedure, Cockpit_Reservation, Chatbot_Glue) with its path and the Kiro spec task identifiers that produced it.
4. THE Provenance_Record SHALL cite the steering file and this spec.

### Requirement 24: Commit policy

**User Story:** As a judge, I want focused commits within the submission
window, so that the hackathon history is honest and reviewable.

#### Acceptance Criteria

1. THE Implementer SHALL make each commit in the Hackathon_Repository focused on one spec task or one record.
2. THE Implementer SHALL create every commit with its actual creation time, on or after 2026-10-30.
3. THE Hackathon_Repository history SHALL contain no commit copied or imported from pre-hackathon history.
4. THE Implementer SHALL commit the `.kiro` directory, including steering and spec files, as part of the submission.

### Requirement 25: Threetched naming (no tched_router)

**User Story:** As the owner, I want hackathon work to address the threetched
view by its correct `threetched` name, so that the `tched_router` naming defect
in the pinned baseline is not built into new code.

#### Acceptance Criteria

1. THE Hackathon_Repository code, procedures, documentation and verification steps SHALL call the Threetched_Surface only through `threetched` operation names.
2. THE Hackathon_Repository SHALL contain no invocation of, dependency on, or interface reference to `tched_router` or `tched-router`, other than Baseline_Record and Blocker_Record entries that describe the naming discrepancy.
3. WHEN the Implementer verifies the `/run/mounts/threetched` view, THE Implementer SHALL perform the granted read with a `threetched` method discovered from the mounted view's sealed Operation_File schemas, in place of `tched_router GetState`.
4. IF the mounted `/run/mounts/threetched` view exposes the Threetched_Surface only under the `tched_router` name, THEN THE Implementer SHALL create a Blocker_Record naming the baseline source locations that carry that name, propose the op-dbus source fix for Owner_Authorization, and leave the dependent verification and Chatbot_Glue tasks in proposed status without calling `tched_router`.
5. THE Baseline_Record SHALL list, as a naming discrepancy, every location in `/srv/git/odbus-verified` that still uses `tched_router` or `tched-router` for the Threetched_Surface, with file path, line and pinned commit.

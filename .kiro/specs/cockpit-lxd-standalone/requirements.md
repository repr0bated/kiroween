# Requirements Document

## Introduction

This spec covers the separate 3tchedW3 subsidiary cockpit as one standalone
LXC system container created through the op-dbus LXD state plugin. The
Standalone_Instance owns the 3tchedW3 Web3 mirror, attestation, key custody,
testnet gating, chain egress, chain submission, and hackathon submission
requirements. The sealed 3tchedW3 identity remains authoritative. The Web3
side is a verifiable mirror or attestation and never a second source of truth.

The Standalone_Instance is separate from the existing main 3tched control-plane
cockpit specified in `.kiro/specs/cockpit-container/`. The main 3tched identity,
Main_Session, and `CockpitBot3tched` remain excluded from this spec and
untouched. This spec creates, changes, renames, repurposes, or references none of
them as the 3tchedW3 cockpit.

The two mounted views are split by what runs each operation:

- The 3tched_View `/run/mounts/3tchedFS` exposes only operations and state that
  run on our code, including op-dbus plugin methods such as `lxd` and
  `identity_sled`.
- The Threetched_View `/run/mounts/threetched` exposes only operations run by
  the ZeroClaw-derived executable `/usr/bin/threetched`, under the `threetched`
  plugin.

The Matching_View is selected by what runs the operation. A Denial, error, or
Unknown_Outcome never authorizes routing through the other view or another
transport.

The guest-facing product contract is filesystem I/O on both mounted FUSE views.
3tched-fs is the SHM_Runtime_Mirror for both views: the FUSE_Daemon presents
current committed op-dbus SHM_State_Tree state through the 3tched_View and the
Threetched_View. Subsidiary Guest_Processes use those FUSE views and never open
the SHM_State_Tree directly. An observed mount, directory entry, or schema
proves that the mounted projection exists, and an observed state value is the
current committed state presented by that projection at the observation time.
Those observations do not by themselves prove correct Guest_Kernel_Identity
binding or completion of a Tool_Call. Every Tool_Call, including LXD, identity,
threetched, signing, egress, chain, and read calls, uses Operation_File dispatch
and op-execution-tracker and requires an Attempt_Record, exactly one matching
Terminal_Record, a matching Receipt, and matching Authoritative_State before it
is reported complete. A successful write or direct state observation cannot
replace that tracker evidence.

The identity-neutral chat interface is defined in
`.kiro/specs/identity-chat-interface/`. This spec owns only the deployment and
operation-file wiring for the 3tchedW3 Standalone_Instance.

op-dbus (`/srv/git/odbus-verified`), 3tched-fs, `identity_sled`, the
identity-bound container architecture and `op-identity-root` are pinned
dependencies. This work reads them and calls them through their existing
interfaces. It never modifies or copies them. All hackathon code lives in
`/srv/git/kiroween`.

Every requirement is subject to `.kiro/steering/security-boundaries.md`. Where
this document and the steering file differ, the steering file wins.

### Source observations at spec time (2026-11-08, read-only)

These observations guide the requirements. The implementation must re-verify
each one and record the result (Requirements 2 and 4). They are not accepted as
current facts without re-verification.

- Baseline `/srv/git/odbus-verified`, branch `main`, HEAD
  `154a1b9db3443dc87bc5d078bd70f4b06674c65c`.
- The pinned source of 3tched-fs lives in the directory `crates/threetched-fs`.
  Its `Cargo.toml` names the package `tched-fs` (L2), the library `tched_fs`
  (L9) and the binary `3tched-fs` (L12). The directory name `threetched-fs`
  and the aliases `tched-fs` and `tched_fs` contradict the naming rule, because
  3tched-fs runs on our code. They are naming defects in pinned source. This
  spec cites `crates/threetched-fs` only as a source location and never as the
  component name (Requirement 13).
- `crates/threetched-fs/src/namespace.rs` L55: the namespace holds an "SHM state
  directory for live reads (`/dev/shm/opdbus/state`)", used only for view mounts.
  L164: "View mounts read live state from SHM; workspace mounts use frozen COW."
- `crates/threetched-fs/src/mounted.rs` L265-266: a lungs view reads present
  state "from committed SHM inside the filesystem"; the mounted-mode client
  process does not open SHM.
- `crates/threetched-fs/src/main.rs` L357: "Mounted mode must never open/create
  an ObjectStore or resolve SHM state."
- `crates/threetched-fs/src/dispatch.rs` defines `LUNGS_OBJECT_PATH`
  (`/org/opdbus/v1/lungs`, L25) and `call_over_socket` (L275). Which path a
  write to `operations/<plugin>/<method>/call` takes inside the filesystem
  daemon is not established. Requirement 3 requires tracing it.
- LXD plugin `crates/op-plugins/src/state_plugins/lxd.rs`: generated single
  file, typed LXD API client, entry `dispatch_lxd_method` (L26280), instance
  types `container` and `virtual-machine`, typed Device union. Observed state:
  the file is **untracked** (`git status` `??`), modified on 2026-11-08 07:16
  UTC (inside the Submission_Window), sha256 prefix `b5c4b3d1d6f77562`. The
  `pub mod lxd;` registration in `state_plugins/mod.rs` exists only in the
  working tree, not at HEAD. No caller of `dispatch_lxd_method` was found
  outside `lxd.rs`. No `plugin.json` schema file for LXD was found in the
  checkout. A `fuse.rs` state plugin is also untracked. The LXD plugin
  therefore does not appear to be a committed, pre-existing dependency.
  This is an expected blocker (Requirement 2).
- Host: no `lxc` or `lxd` binary on `PATH`, no `/var/snap/lxd` or
  `/var/lib/lxd`; `/usr/bin/incus` is present. No LXD daemon was observed.
  This is an expected blocker (Requirement 4).
- Host: `/run/mounts/3tchedFS` and `/dev/shm/opdbus/state` exist. Whether
  `/run/mounts/3tchedFS` is the 3tchedW3_Identity's assigned namespace was not
  established; no 3tchedW3_Identity has been observed by this spec's read-only
  discovery.
- Owner correction: the threetched view is addressed as `threetched`, never
  `tched_router`. `tched_router` / `tched-router` is a naming defect in pinned
  source for the Threetched_Surface.
- Which plugins 3tched-fs places in the 3tched_View and which in the
  Threetched_View was not established at spec time. Both views present current
  committed SHM_State_Tree state through the 3tched-fs FUSE_Daemon;
  Requirement 3 traces that read path and the view assignment.

### Open questions for owner decision

These are recorded, not assumed. Requirement 5 governs how they are resolved.

1. **Meaning of "standalone".** Candidates: (a) an LXD instance on the same VPS
   outside the Incus identity-bound architecture; (b) an LXD instance on a
   separate host; (c) an instance without the shared Seed and Leaf storage.
   Option (b) cannot give 3tched-fs direct access to the backend SHM state
   tree, because SHM does not cross hosts.
2. **LXD availability and grants.** Whether an LXD daemon is present, and
   whether the 3tchedW3_Identity holds grants for `lxd` plugin methods. No
   3tchedW3_Identity mount exists yet.
3. **Storage model.** Whether the Seed, Leaf and Seven_Subvolumes model applies
   to LXD instances.
4. **LXD plugin provenance.** Whether the untracked, in-window `lxd.rs` (and
   `fuse.rs`) is to be treated as a pinned dependency, committed upstream in
   op-dbus first, or excluded.
5. **SHM visibility mechanism.** 3tched-fs presents current committed
   SHM_State_Tree state through both mounted FUSE views. The open decision is
   whether the 3tched-fs daemon runs host-side and its 3tched_View and
   Threetched_View mounts are passed into the instance, or the SHM state tree
   is made available only to an in-instance 3tched-fs daemon, or another
   mechanism preserves the same boundary. Under every option, subsidiary
   Guest_Processes use the FUSE views and never open the SHM state tree
   directly.
6. **Chain egress path.** Which existing outbound-only Egress_Path exposes
   signing, submission, and chain-read operations to the 3tchedW3_Identity
   through its Matching_View. If no permitted existing path is established,
   chain submission remains proposed.

## Glossary

- **3tched_Identity**: The existing main sealed 3tched identity that owns the
  existing main control-plane cockpit, Main_Session, and Reserved_Main_Names.
  The 3tched_Identity is outside this spec.
- **3tchedW3_Identity**: The separate hackathon identity assigned only to the
  3tchedW3 Standalone_Instance, including the identity's sealed credentials,
  grants, session, and W3_Key.
- **Sealed_Identity**: The authoritative identity state held by op-dbus and
  `identity_sled`, including principal, session, public key, genesis, grants,
  and Receipts.
- **SID1**: The sealed identity credential envelope. SID1 bytes and every
  digest computed from SID1 bytes are prohibited from Anchored_Data.
- **Main_Session**: The existing session
  `b0c777e3-0955-cd8b-3d01-ca12998cae28` of the 3tched_Identity. Main_Session is
  outside this spec.
- **Reserved_Main_Names**: `3tchedChatbot`, `3tchedCockpitBot`,
  `3tchedCtlChatbot`, and `CockpitBot3tched`, which belong to the
  3tched_Identity and are unavailable to the 3tchedW3_Identity.
- **Receipt**: The completed result returned through an Operation_File and
  linked to Tracker_Evidence for the same `operation_id`.
- **Authoritative_State**: Current committed state read back from the owning
  op-dbus plugin through a separate granted Operation_File after the operation
  Receipt. Authoritative_State must match the Tool_Call's Attempt_Record,
  single Terminal_Record, and Receipt when used as completion evidence.
- **Operation_File**: A path of the form
  `operations/<plugin>/<method>/call` in the assigned identity's Matching_View.
- **Guest_Kernel_Identity**: The caller identity and session attributed by the
  guest-kernel mounted-view path without a caller-supplied SID1 path or session
  override.
- **Catalog_Pin**: The sealed catalog hash and generation used to select and
  validate one Tool_Call.
- **Tool_Call**: One requested invocation of one plugin method with one input,
  one `subid`, one `operation_id`, and one Catalog_Pin.
- **Read_Tool_Call**: A Tool_Call whose sealed catalog method declaration has a
  recognized read-only side effect.
- **Mutation_Tool_Call**: A Tool_Call whose sealed catalog method declaration
  has a mutation side effect, no side-effect declaration, or an unrecognized
  side-effect declaration.
- **PluginV1_Path**: The existing operation protocol path from an
  Operation_File write through PluginV1, lungs dispatch, backend dispatch,
  op-execution-tracker, and Receipt return.
- **op-execution-tracker**: The pinned existing path that records attributed
  execution attempts, terminal outcomes, and execution hash-chain links.
- **Attempt_Record**: The op-execution-tracker record created before backend
  execution for a Tool_Call.
- **Terminal_Record**: The single op-execution-tracker record that closes one
  Tool_Call `operation_id` with an outcome.
- **Execution_Hash_Chain_Linkage**: The record hash and preceding-record hash
  fields that link an Attempt_Record or Terminal_Record into the existing
  execution chain.
- **Tracker_Evidence**: One attributed Attempt_Record and exactly one matching
  Terminal_Record for the same Tool_Call.
- **Unknown_Outcome**: A Tool_Call outcome for which matching Tracker_Evidence,
  Receipt, and Authoritative_State do not establish one terminal result.
- **Denial**: A permission, capability, policy, identity, catalog, view, or
  operation refusal.
- **Blocker_Record**: A redacted record of a Denial, Unknown_Outcome, missing
  dependency, attribution mismatch, or invariant failure.
- **Owner_Authorization**: An explicit recorded authorization from the owner
  for one named Live_Change and target.
- **Live_Change**: A change to a live identity, grant, credential, storage,
  mount, service, deployment, container, catalog, runtime process, or chain
  state.
- **Seed**: The immutable read-only shared Btrfs base image.
- **Leaf**: The identity-specific writable Btrfs device assigned to a container.
- **Seven_Subvolumes**: The Btrfs sibling subvolumes `@`, `@agent_memory`,
  `@agent_rules`, `@agent_shared`, `@agent_skills`, `@agent_soul`, and
  `@agent_user`.
- **Hardware_Identifier**: A machine-derived binding value, including
  machine-id, DMI or SMBIOS data, a MAC address, disk serial, TPM endorsement
  key, CPU identifier, hostname, or container runtime UUID.
- **Lungs_Socket**: `/run/opdbus/lungs/lungs.sock`, the existing and only
  permitted host channel for the Standalone_Instance.
- **External_Provisioner**: The existing host provisioner `op-identity-root`,
  the only authorized component that may add one blank Leaf during explicit
  creation.
- **Baseline_Record**: The hackathon document that records pinned source
  interfaces, provenance, callers, and trace evidence.
- **Runtime_Record**: The hackathon document that records read-only observed
  runtime evidence.
- **Provenance_Record**: `PROVENANCE.md` at the Hackathon_Repository root.
- **Status_Report**: A report that separates proposed, implemented, built,
  tested, and deployed status.
- **Hackathon_Repository**: `/srv/git/kiroween`, the repository for all new
  work governed by this spec.
- **Implementer**: The agent or engineer carrying out this spec.
- **Submission_Window**: The hackathon period that opened on 2026-10-30.
- **3tched-fs**: Our FUSE filesystem, which runs on our code and serves both
  3tchedFS_Views from one sealed catalog and one identity enforcement. Its
  pinned source is at `crates/threetched-fs` in `/srv/git/odbus-verified`, and
  its binary is named `3tched-fs`. The source directory name is a naming
  defect (Requirement 13).
- **3tched_View**: The guest view `/run/mounts/3tchedFS`, served by 3tched-fs.
  It exposes only operations and state that run on our code, including op-dbus
  plugin methods such as `lxd` and `identity_sled`.
- **Threetched_View**: The guest view `/run/mounts/threetched`, served by
  3tched-fs. It exposes only operations run by the ZeroClaw-derived executable
  `/usr/bin/threetched`.
- **3tchedFS_Views**: The 3tched_View and the Threetched_View together, with
  their sealed catalog and identity enforcement.
- **Threetched_Surface**: The operations run by the ZeroClaw-derived executable
  `/usr/bin/threetched`, exposed under the `threetched` plugin in the
  Threetched_View. `tched_router` / `tched-router` is a defective pinned name
  for this surface that hackathon code never uses as an interface name.
- **Matching_View**: For a given operation, the 3tched_View if the operation
  runs on our code, or the Threetched_View if the operation is run by
  `/usr/bin/threetched`.

New terms:

- **LXD_Plugin**: The op-dbus state plugin at
  `crates/op-plugins/src/state_plugins/lxd.rs` with entry `dispatch_lxd_method`,
  reached only through `/run/mounts/3tchedFS/operations/lxd/<method>/call`
  Operation_Files in the 3tched_View. The LXD_Plugin runs on our code.
- **LXD_Daemon**: The LXD server process that the LXD_Plugin drives.
- **Standalone_Instance**: An LXC system container (LXD instance type
  `container`) created through the LXD_Plugin to run the 3tchedW3 cockpit. Its
  exact placement and storage scope are Open questions 1 and 3.
- **Standalone_Reservation**: The hackathon record that reserves an LXD
  instance name, the 3tchedW3_Identity session id, principal id and public key
  fingerprint for one Standalone_Instance.
- **Standalone_Reservation validator**: The hackathon check that accepts or
  rejects a Standalone_Reservation and names each failing field.
- **Instance_Spec**: The hackathon document, derived from the LXD_Plugin
  sealed schema, that lists the instance configuration keys and Device entries
  submitted for a Standalone_Instance.
- **Instance_Spec validator**: The hackathon check that accepts or rejects an
  Instance_Spec and its Visibility_Mechanism and names each failing Device,
  mount or configuration key.
- **FUSE_Daemon**: The 3tched-fs filesystem process that serves the
  3tchedFS_Views and resolves SHM state.
- **SHM_State_Tree**: The committed op-dbus present-state tree at
  `/dev/shm/opdbus/state`.
- **SHM_Read_Path**: The traced code path by which the FUSE_Daemon presents
  current committed SHM_State_Tree state through one of the 3tchedFS_Views.
  One SHM_Read_Path is traced per view.
- **Call_Path**: The traced code path by which the FUSE_Daemon handles a write
  to an Operation_File in one of the 3tchedFS_Views and returns its Receipt.
  One Call_Path is traced per view.
- **View_Assignment**: The traced rule in 3tched-fs source that decides which
  plugins and operations each of the 3tchedFS_Views exposes.
- **Visibility_Mechanism**: The design-selected means by which 3tched-fs
  presents the SHM_Runtime_Mirror through both 3tchedFS_Views to a
  Standalone_Instance without giving subsidiary Guest_Processes direct access
  to the SHM_State_Tree.
- **Guest_Process**: Any process running inside a Standalone_Instance.
- **Guest_Backend_Access**: Any interaction of a Guest_Process with the op-dbus
  backend.
- **Host_Channel**: A direct socket, shared directory, device, proxy, or network
  path between the Standalone_Instance and the host. The guest-visible
  3tchedFS_Views are filesystem surfaces served through the existing
  Lungs_Socket path and are not additional Host_Channels unless the selected
  Visibility_Mechanism passes a host mount or SHM_State_Tree share directly
  into the Standalone_Instance.
- **Channel_Inventory**: The design-time list of every Host_Channel of a
  Standalone_Instance with its direction, owner and justification.
- **Provisioning_Procedure_LXD**: The hackathon procedure that creates a
  Standalone_Instance by calling LXD_Plugin Operation_Files.
- **Lifecycle_Operation_LXD**: Start, stop, restart, recovery or failed-start
  cleanup of a Standalone_Instance.
- **Cockpit_Glue_LXD**: The hackathon code inside a Standalone_Instance that
  connects the 3tchedW3 chatbot to operations through the 3tchedFS_Views. The
  Cockpit_Glue_LXD runs on our code and is named 3tched.
- **Tool_Executor**: The hackathon component that validates and submits every
  Tool_Call through one Operation_File in the Matching_View and evaluates
  Tracker_Evidence, Receipt, and Authoritative_State.
- **SHM_Runtime_Mirror**: The 3tched-fs FUSE presentation of current committed
  op-dbus SHM_State_Tree state through both 3tchedFS_Views. The projection is
  the guest filesystem interface to current committed state. Observing the
  projection does not by itself establish Guest_Kernel_Identity attribution or
  Tool_Call completion.
- **Audit_Chain**: The existing op-execution-tracker execution hash chain.
- **Web3_Mirror**: The hackathon component owned by the Standalone_Instance that
  publishes a verifiable chain attestation of the 3tchedW3_Identity and derived
  audit data.
- **Attestation**: A deterministic record derived from public Sealed_Identity
  fields, Receipts, and Audit_Chain records for chain anchoring.
- **Attestation_Deriver**: The hackathon component that computes Attestations,
  Receipt digests, audit roots, and inclusion proofs from source records.
- **Attestation_Codec**: The hackathon encoder and decoder for the canonical
  Attestation byte form selected in `design.md`.
- **Anchored_Data**: Public identity commitments, Attestation digests, audit
  roots, and Receipt digests submitted to a chain. Anchored_Data excludes SID1
  bytes, SID1 digests, private keys, and non-public identity fields.
- **W3_Key**: Signing key material owned by and sealed inside the
  3tchedW3_Identity.
- **Signing_Operation**: A granted 3tched Operation_File method that signs a
  validated testnet payload inside the 3tchedW3_Identity and returns only the
  signature and public-key data.
- **Chain_Submitter**: The hackathon component that validates a
  Chain_Submission and invokes signing, Egress_Path, and chain Operation_Files
  through the 3tched_View.
- **Chain_Submission**: One request to publish Anchored_Data to a permitted
  testnet target, identified by one chain id, network, contract or standard,
  payload digest, `subid`, and `operation_id`.
- **Testnet_Allowlist**: The exact set of permitted testnet chain identifiers
  selected in `design.md`.
- **Egress_Path**: An existing outbound-only egress operation and path named in
  `design.md`, owned by a pinned component, and exposed through an
  Operation_File in the Matching_View.
- **Chain_Authoritative_State**: Chain state read after submission through a
  granted chain-read Operation_File, including the target chain id,
  transaction or attestation identifier, block reference, and committed
  Attestation digest.
- **Submission_Package**: The hackathon submission material for this standalone
  3tchedW3 subsidiary, including source, provenance, build and deployment
  status, demo evidence, security disclosures, and chain evidence.

## Requirements

### Requirement 1: Separate subsidiary scope

**User Story:** As the owner, I want the 3tchedW3 subsidiary LXD cockpit in its
own spec, so that the existing main 3tched control-plane cockpit remains
excluded and untouched.

#### Acceptance Criteria

1. THE Implementer SHALL keep the requirements, design and tasks documents of this spec, and every Baseline_Record, Runtime_Record and Blocker_Record created for this spec, in `.kiro/specs/cockpit-lxd-standalone/`.
2. THE Implementer SHALL make no commit for this spec that adds, modifies, deletes or renames any file under `.kiro/specs/cockpit-container/`, so that the `git diff` of that directory between the commit before this spec's first commit and the latest commit of this spec is empty.
3. THE Standalone_Instance SHALL own the Web3_Mirror, Attestation_Deriver, Attestation_Codec, W3_Key custody, Testnet_Allowlist enforcement, Egress_Path use, Chain_Submitter, Chain_Submission evidence, and Submission_Package governed by this spec.
4. THE Implementer SHALL keep the 3tched_Identity, Main_Session, `CockpitBot3tched`, and every Reserved_Main_Names entry outside the identity, provisioning, lifecycle, Web3, chain, and submission actions of this spec.
5. IF an action under this spec targets the 3tched_Identity, Main_Session, `CockpitBot3tched`, or another Reserved_Main_Names entry, THEN THE Implementer SHALL stop the action and create a Blocker_Record naming the mismatched target without modifying the target.
6. IF a statement in this spec differs from `.kiro/steering/security-boundaries.md`, THEN THE Implementer SHALL follow `.kiro/steering/security-boundaries.md`.

### Requirement 2: LXD plugin baseline discovery

**User Story:** As the owner, I want the LXD plugin's actual status recorded, so
that hackathon work does not treat uncommitted code as a pinned dependency.

#### Acceptance Criteria

1. THE Baseline_Record SHALL record, for the LXD_Plugin: the checked-out branch and full 40-character HEAD commit hash of `/srv/git/odbus-verified`, the LXD_Plugin path relative to the repository root, its full 64-hex-character sha256 digest, and its last-modified time in UTC.
2. THE Baseline_Record SHALL record the LXD_Plugin git status as exactly one of: tracked and unmodified at HEAD, tracked and modified in the working tree, untracked, or ignored; and, if tracked, the hash and commit date of the commit that first added the file and whether that date is before 2026-10-30.
3. THE Baseline_Record SHALL record whether a `pub mod lxd;` registration exists in `crates/op-plugins/src/state_plugins/mod.rs` at HEAD and in the working tree, with the line number of each occurrence found.
4. THE Baseline_Record SHALL list every caller of `dispatch_lxd_method` found by a search of the whole `/srv/git/odbus-verified` checkout at HEAD and in the working tree, each with file, line number and enclosing function, together with the search command used; if no caller is found, it SHALL record "none found" with that command.
5. THE Baseline_Record SHALL record the file, line number and function of the dispatcher that routes `/run/mounts/3tchedFS/operations/lxd/<method>/call` writes in the 3tched_View to the LXD_Plugin, or record "not found" with the locations searched.
6. THE Baseline_Record SHALL record the path and catalog hash of the LXD_Plugin sealed schema, or record that no sealed schema was found together with every location searched.
7. WHEN an LXD_Plugin sealed schema is found, THE Baseline_Record SHALL list from it the method name and argument schema for each of instance create, instance get, instance state read, start, stop, delete and Device configuration, and SHALL mark any of these seven operations that the schema lacks as "absent from sealed schema".
8. IF no LXD_Plugin sealed schema is found, THEN THE Baseline_Record SHALL mark each of the seven operations in criterion 7 as "no sealed schema" and SHALL present no argument schema derived from `lxd.rs` source as a sealed schema.
9. IF the LXD_Plugin is untracked, is not registered in `mod.rs` at HEAD, or has a last-modified time or first-adding commit date on or after 2026-10-30, THEN THE Implementer SHALL create a Blocker_Record that names each of these conditions found with its recorded evidence and asks the owner to decide the LXD_Plugin provenance (Open question 4), and SHALL leave every task that writes to an `operations/lxd/<method>/call` Operation_File in proposed status until the owner decides.
10. THE Implementer SHALL perform LXD_Plugin discovery only with operations that do not write to the working tree, index, refs or configuration of `/srv/git/odbus-verified`, so that `git status --porcelain` output for that checkout is identical before and after discovery.

### Requirement 3: 3tched-fs read path, call path and view assignment discovery

**User Story:** As the owner, I want the 3tched-fs read path, call path and view
assignment traced in source for each view, so that the design confirms the
implemented path for the committed-SHM runtime mirror.

#### Acceptance Criteria

1. THE Baseline_Record SHALL record one SHM_Read_Path for the 3tched_View and one SHM_Read_Path for the Threetched_View, each as an ordered sequence of source locations given as file path relative to the repository root, 1-based line number and function name, in the 3tched-fs source at `crates/threetched-fs` at the HEAD commit recorded under Requirement 2, starting at the FUSE read handler for a file in that view and ending at the read of current committed state in the SHM_State_Tree.
2. THE Baseline_Record SHALL record one Call_Path for a write to `operations/<plugin>/<method>/call` in the 3tched_View and one Call_Path for a write to `operations/threetched/<method>/call` in the Threetched_View, each as an ordered sequence of source locations in the form of criterion 1, starting at the FUSE write handler for the Operation_File and ending where the Receipt is made readable to the caller, and SHALL state for each view whether the FUSE_Daemon reaches the backend through `call_over_socket`, the `/org/opdbus/v1/lungs` object path, or another named route.
3. THE Baseline_Record SHALL record which process (mounted-mode client or FUSE_Daemon) opens the SHM_State_Tree for a view mount, with the source location of the open, and which process is prohibited from opening it, with the source location of the prohibition.
4. THE Baseline_Record SHALL record, for each of the four traced paths (the SHM_Read_Path and the Call_Path of the 3tched_View and of the Threetched_View), the source location where the sealed catalog pin is enforced and the source location where the kernel-bound caller identity is enforced, and SHALL record "no enforcement found" for any of these eight entries where none is found.
5. THE Baseline_Record SHALL record whether any file under the 3tched-fs source directory `crates/threetched-fs` differs between HEAD and the working tree, and SHALL list each differing file.
6. IF a traced SHM_Read_Path, Call_Path or View_Assignment differs from a description in a source comment, a documentation file in `/srv/git/odbus-verified`, the Source observations of this spec, or the owner naming rule in `.kiro/steering/naming-3tched-threetched.md`, THEN THE Baseline_Record SHALL record the documented claim or rule with its source location and the traced behaviour with its source location.
7. IF any SHM_Read_Path or Call_Path cannot be traced from its starting location to its ending location, THEN THE Implementer SHALL record the view, the last source location reached and the unresolved step in the Baseline_Record, SHALL create a Blocker_Record naming the untraced path and its view, and SHALL leave every task that depends on the untraced path, including selection of the Visibility_Mechanism, in proposed status.
8. THE Implementer SHALL trace every path in this requirement by reading source only, without building, running or mounting 3tched-fs, and without writing to the working tree, index, refs or configuration of `/srv/git/odbus-verified`.
9. THE Baseline_Record SHALL record the View_Assignment as the ordered source locations, in the form of criterion 1, where 3tched-fs decides whether a plugin or operation is exposed in the 3tched_View or the Threetched_View, and SHALL list, for the `lxd`, `identity_sled` and `threetched` plugins, the view or views in which the View_Assignment exposes each plugin.
10. IF the View_Assignment exposes a plugin that runs on our code in the Threetched_View, exposes an operation run by `/usr/bin/threetched` in the 3tched_View, or cannot be traced, THEN THE Implementer SHALL create a Blocker_Record naming each such plugin or operation with its source location, and SHALL leave every task that calls that plugin or operation in proposed status.

### Requirement 4: Runtime discovery for LXD standalone

**User Story:** As the owner, I want the live LXD and 3tchedFS state recorded, so
that source definitions are not mistaken for deployment.

#### Acceptance Criteria

1. THE Runtime_Record SHALL state whether an LXD_Daemon is present and whether it is reachable by the LXD_Plugin. For each of the two statements it SHALL record the evidence observed: the binaries and paths checked with the result of each check, and, for reachability, the Receipt of a granted read-only `lxd` Operation_File call or the reason no such call could be made.
2. THE Runtime_Record SHALL state whether the 3tchedW3_Identity's mounted 3tched_View exposes `/run/mounts/3tchedFS/operations/lxd/<method>/call` Operation_Files. It SHALL list each exposed `lxd` method and mark each one as granted or not granted to the 3tchedW3_Identity, with the evidence observed for each mark, and SHALL record each `lxd` Operation_File found under the Threetched_View as a View_Assignment defect under Requirement 3 criterion 10.
3. THE Runtime_Record SHALL state whether the SHM_State_Tree exists and, if it exists, its owner and mode. For each FUSE_Daemon mount that serves the SHM_State_Tree, it SHALL record the mount point, the kernel mount source and the owning process user.
4. THE Runtime_Record SHALL classify each finding as exactly one of: observed runtime state, source definition only, or not found. Each finding SHALL record the observation time (UTC) and the read-only command or Operation_File read that produced it.
5. THE Runtime_Record SHALL list each existing LXD instance with the session it carries, or "no session found" if it carries none. It SHALL mark an instance as belonging to the 3tchedW3_Identity only if the instance's session equals the 3tchedW3_Identity session, and SHALL mark every other instance as not belonging to the 3tchedW3_Identity.
6. IF no LXD_Daemon is present, THEN THE Implementer SHALL create a Blocker_Record naming each checked path and binary with the result of each check, and SHALL leave the dependent provisioning tasks in proposed status.
7. IF the 3tchedW3_Identity's 3tched_View is not mounted or lacks `lxd` grants, THEN THE Implementer SHALL create a Blocker_Record naming the missing mount or each missing `lxd` method grant, and SHALL leave the dependent provisioning tasks in proposed status.
8. THE Implementer SHALL perform runtime discovery using read-only operations only. During discovery the Implementer SHALL make no write to an Operation_File of a method that creates, modifies, starts, stops or deletes state, SHALL start, stop or restart no service, and SHALL change no identity, grant, storage or mount.
9. IF a discovery read is denied or returns an error, THEN THE Implementer SHALL record the finding as not found, with the operation and the error, and SHALL handle a Denial under Requirement 14 without retrying the read through another route.

### Requirement 5: Open question resolution

**User Story:** As the owner, I want unresolved scope questions decided by me, so
that the design does not silently pick a meaning for "standalone".

#### Acceptance Criteria

1. THE `design.md` document SHALL list each of Open questions 1 to 6 from the Introduction by number. For each question it SHALL record either the status "awaiting owner decision" or the owner's decision with its date and a reference to the owner statement or Owner_Authorization that records it.
2. THE Implementer SHALL record an owner decision for an open question only from an explicit owner statement or Owner_Authorization, and SHALL NOT infer a decision from source observations, runtime findings or defaults.
3. THE `tasks.md` document SHALL list, for each task, the numbers of the open questions it depends on, or "none".
4. WHILE an open question has the status "awaiting owner decision", THE Implementer SHALL leave every task that `tasks.md` lists as depending on that question in proposed status.
5. IF the owner selects a Standalone_Instance placement on a host other than the host holding the SHM_State_Tree, THEN THE Implementer SHALL create a Blocker_Record stating that the FUSE_Daemon cannot read a remote SHM_State_Tree directly, and SHALL leave the tasks that depend on Open question 1 in proposed status.
6. IF a recorded owner decision conflicts with a rule in `.kiro/steering/security-boundaries.md`, THEN THE Implementer SHALL create a Blocker_Record naming the open question, the decision and the steering rule, and SHALL leave the dependent tasks in proposed status. The Implementer SHALL leave the steering file unmodified.

### Requirement 6: Instance creation through the LXD plugin

**User Story:** As the owner, I want the standalone instance created only
through the LXD plugin's operation files, so that every creation step is granted
and attributed.

#### Acceptance Criteria

1. THE Provisioning_Procedure_LXD SHALL invoke LXD_Plugin methods only by writing to `/run/mounts/3tchedFS/operations/lxd/<method>/call` Operation_Files in the 3tchedW3_Identity's mounted 3tched_View, because the LXD_Plugin runs on our code.
2. THE Provisioning_Procedure_LXD SHALL build each method argument from the argument schema that the mounted Operation_File for that method exposes at runtime. Each argument SHALL contain only fields defined in that schema.
3. IF the mounted namespace exposes no argument schema for a required `lxd` method, or a built argument fails validation against that schema, THEN THE Provisioning_Procedure_LXD SHALL write nothing to that Operation_File and SHALL create a Blocker_Record naming the method and the missing schema or each failing field.
4. THE Instance_Spec SHALL set the LXD instance type to `container`.
5. THE Instance_Spec SHALL set `security.privileged` to `false`, `security.nesting` to `false` and `boot.autostart` to `false` as explicit entries, without relying on LXD default values.
6. THE Instance_Spec SHALL list every Device entry with its LXD Device type and the Host_Channel entry in the Channel_Inventory that justifies the Device.
7. IF an Instance_Spec contains an LXD `proxy` Device, a `nic` Device with an inbound port mapping, or a Device absent from the Channel_Inventory, THEN THE Instance_Spec validator SHALL reject the Instance_Spec, name every such Device, and the Provisioning_Procedure_LXD SHALL write nothing to any `lxd` Operation_File for that Instance_Spec.
8. THE Provisioning_Procedure_LXD SHALL bind the Standalone_Instance to the 3tchedW3_Identity session recorded in the Standalone_Reservation, so that the Authoritative_State read back after creation shows that session id for the instance. IF the LXD_Plugin schema offers no means to carry the session, THEN THE Implementer SHALL create a Blocker_Record and leave creation in proposed status.
9. IF an `lxd` create call returns an error or a Receipt indicating failure, THEN THE Provisioning_Procedure_LXD SHALL make no further create call for that Standalone_Reservation, SHALL record the method, argument, caller and error in a Blocker_Record, and SHALL handle a Denial or unknown outcome under Requirement 14.
10. THE Hackathon_Repository SHALL reference the LXD_Plugin by path and pinned commit or recorded working-tree digest and SHALL contain no copy of LXD_Plugin source.
11. THE Hackathon_Repository SHALL contain no direct `lxc`, `lxd` or LXD REST API invocation outside the LXD_Plugin Operation_Files.
12. IF an `lxd` Operation_File is found under the Threetched_View, THEN THE Provisioning_Procedure_LXD SHALL write nothing to that Operation_File, and THE Implementer SHALL record the path as a View_Assignment defect under Requirement 3 criterion 10.

### Requirement 7: Standalone reservation and main identity exclusion

**User Story:** As the owner, I want the standalone instance reserved under the
3tchedW3 identity only, so that it never collides with the main 3tched identity.

#### Acceptance Criteria

1. THE Standalone_Reservation SHALL record the LXD instance name, the 3tchedW3_Identity session id, the 3tchedW3_Identity principal id, the 3tchedW3_Identity public key fingerprint with its digest algorithm, and the source location (file, line, function) of the derivation used under criterion 2.
2. THE Standalone_Reservation SHALL derive its session id and principal id from the 3tchedW3_Identity public key using the existing derivation in `crates/op-identity/src/session.rs`, called through its existing interface, and the Hackathon_Repository SHALL contain no copy of that derivation.
3. IF the existing derivation cannot be called from the Hackathon_Repository without modifying `/srv/git/odbus-verified`, THEN THE Implementer SHALL create a Blocker_Record naming the derivation function and the missing interface, and SHALL leave the Standalone_Reservation task in proposed status.
4. WHEN a Standalone_Reservation is validated, THE Standalone_Reservation validator SHALL reject an instance name equal to a Reserved_Main_Names entry, compared case-insensitively, with an error naming the matched entry.
5. WHEN a Standalone_Reservation is validated, THE Standalone_Reservation validator SHALL reject a session id equal to the Main_Session, compared case-insensitively in hyphenated form, with an error naming the session field.
6. WHEN a Standalone_Reservation is validated, THE Standalone_Reservation validator SHALL re-derive the session id and principal id from the recorded public key through the derivation of criterion 2 and SHALL reject the reservation with an error naming each recorded field that differs from the re-derived value.
7. IF a Standalone_Reservation binding input contains a Hardware_Identifier, THEN THE Standalone_Reservation validator SHALL reject the input with an error naming the field.
8. IF a Standalone_Reservation contains SID1 bytes, a digest of a SID1 credential or private key material, THEN THE Standalone_Reservation validator SHALL reject the reservation with an error naming the field, and the error SHALL contain no part of the rejected value.
9. FOR ALL candidate reservations, THE Standalone_Reservation validator SHALL accept a reservation only when its name is outside Reserved_Main_Names, its session differs from the Main_Session, its session id and principal id equal the values re-derived from its public key, and no field fails criterion 7 or 8.

### Requirement 8: Backend access by filesystem I/O only

**User Story:** As the cockpit operator, I want the instance to reach the backend
only through filesystem calls on the FUSE views, so that the guest has no
network or socket path into op-dbus.

#### Acceptance Criteria

1. THE Cockpit_Glue_LXD SHALL perform Guest_Backend_Access only through open, read, write, readdir, stat and close calls on paths under `/run/mounts/3tchedFS` and `/run/mounts/threetched`.
2. THE Cockpit_Glue_LXD SHALL invoke an operation by writing its argument to the Operation_File in the operation's Matching_View and reading the Receipt back from the same Operation_File path in the same mounted view.
3. THE Cockpit_Glue_LXD SHALL read present state only from the mounted 3tchedFS_Views, each read in the Matching_View of the plugin read, whose FUSE_Daemon serves the state from the SHM_State_Tree along the SHM_Read_Path recorded for that view under Requirement 3, and SHALL open no SHM_State_Tree path directly.
4. THE Cockpit_Glue_LXD SHALL contain no socket client, D-Bus client, HTTP client or other network client for Guest_Backend_Access.
5. THE Implementer SHALL record in the Status_Report, for the Cockpit_Glue_LXD source and dependency manifests, each use of a socket, D-Bus, HTTP or other network client API with file and line, or "none found", together with the search command used.
6. IF the source inspection of criterion 5 finds a socket, D-Bus, HTTP or other network client used for Guest_Backend_Access, THEN THE Implementer SHALL report the Cockpit_Glue_LXD as not conforming and SHALL name each finding with file and line.
7. WHEN a Standalone_Instance has started, THE Implementer SHALL record in the Runtime_Record every open socket held by each Cockpit_Glue_LXD process, with its type, local address and peer address, using read-only inspection inside the instance.
8. IF the runtime inspection of criterion 7 shows a Cockpit_Glue_LXD process holding a socket connected to the Lungs_Socket, a D-Bus bus or any other op-dbus endpoint, THEN THE Implementer SHALL create a Blocker_Record naming the process, the socket and the peer, and SHALL report the Cockpit_Glue_LXD as not conforming.
9. THE Hackathon_Repository SHALL describe the 3tchedFS_Views as the Guest_Process filesystem interface, the SHM_Runtime_Mirror as the 3tched-fs presentation of current committed SHM_State_Tree state, and the Lungs_Socket as the pinned 3tched-fs underlying host channel rather than a direct Cockpit_Glue_LXD client interface.
10. THE Cockpit_Glue_LXD SHALL use the kernel-bound caller identity of the Standalone_Instance, and neither the Cockpit_Glue_LXD source nor the command line of any Cockpit_Glue_LXD process SHALL contain a SID1 file path or a `--lungs-session` value.
11. IF an operation that the Cockpit_Glue_LXD needs is not exposed as an Operation_File in its Matching_View, THEN THE Implementer SHALL create a Blocker_Record naming the operation and its Matching_View and SHALL perform the operation through no other route, including the other view.
12. THE Cockpit_Glue_LXD SHALL make each call to an operation that runs on our code, including `lxd` and `identity_sled` methods, under `/run/mounts/3tchedFS/operations/`, and each call to an operation run by `/usr/bin/threetched` under `/run/mounts/threetched/operations/threetched/`.
13. IF a call in the Matching_View is denied or returns an error, THEN THE Cockpit_Glue_LXD SHALL make no call for that operation through the other view, and THE Implementer SHALL handle the Denial or error under Requirement 14.
14. IF the View_Assignment recorded under Requirement 3 criterion 9 does not determine the Matching_View of an operation, THEN THE Cockpit_Glue_LXD SHALL make no call for that operation, and THE Implementer SHALL create a Blocker_Record naming the operation.
15. IF a traced SHM_Read_Path does not end at current committed state in the SHM_State_Tree, THEN THE Implementer SHALL create a Blocker_Record naming the view, the last established source location and the observed backing state, and SHALL leave every task that reads present state through that view in proposed status.

### Requirement 9: Present committed SHM state through the runtime mirror

**User Story:** As the owner, I want 3tched-fs to present current committed
op-dbus SHM state through both mounted views while retaining tracked Tool_Call
completion, so that subsidiary processes use the FUSE boundary without
mistaking a projection observation for execution evidence.

#### Acceptance Criteria

1. WHEN the Runtime_Record observes a mounted 3tchedFS_View path, directory entry, or schema, THE Runtime_Record SHALL record the observation as proof that the corresponding mounted projection exists.
2. WHEN the Runtime_Record observes a state value through a 3tchedFS_View, THE Runtime_Record SHALL record the value as current committed SHM_State_Tree state presented by 3tched-fs at the observation time.
3. THE Runtime_Record SHALL record a filesystem-write result separately from an SHM_Runtime_Mirror state observation.
4. THE Implementer SHALL require Guest_Kernel_Identity, one Attempt_Record, exactly one matching Terminal_Record, a matching Receipt, and matching Authoritative_State before using any mount, schema, state, read, or write observation to report a Tool_Call complete.
5. THE `design.md` document SHALL name the selected Visibility_Mechanism and each alternative considered, including the host-side 3tched-fs mount and in-instance 3tched-fs daemon candidates from Open question 5, and SHALL cite the SHM_Read_Path and Call_Path source locations recorded for both views under Requirement 3.
6. WHILE Open question 5 has the status "awaiting owner decision", or a SHM_Read_Path, Call_Path, catalog-enforcement path, or identity-enforcement path remains untraced, THE `design.md` document SHALL record the Visibility_Mechanism as "not selected" and THE Implementer SHALL leave every dependent task in proposed status.
7. THE selected Visibility_Mechanism SHALL preserve the sealed catalog pin, Guest_Kernel_Identity enforcement, and Lungs_Socket-only Host_Channel for every read and write in both 3tchedFS_Views.
8. IF a Visibility_Mechanism gives a subsidiary Guest_Process direct access to the SHM_State_Tree, passes a host-side FUSE mount into the Standalone_Instance as an additional Host_Channel, or bypasses sealed catalog or Guest_Kernel_Identity enforcement, THEN THE Instance_Spec validator SHALL reject the Visibility_Mechanism and name each violating Device, mount, or path.
9. THE Cockpit_Glue_LXD SHALL open no SHM_State_Tree path directly and SHALL access state only through an Operation_File or state path in the Matching_View.
10. WHEN a mounted-view read is a Read_Tool_Call or supplies Authoritative_State for Tool_Call completion, THE Tool_Executor SHALL dispatch the read through an Operation_File and provide the Guest_Kernel_Identity, Attempt_Record, exactly one matching Terminal_Record, Receipt, and matching state result for the read.
11. IF an SHM_Runtime_Mirror value differs from matching Authoritative_State for the same plugin, field, catalog hash, catalog generation, and observation point, THEN THE Implementer SHALL create a Blocker_Record naming the mismatch and SHALL report no affected Tool_Call complete.
12. FOR ALL Guest_Process write attempts on SHM_State_Tree paths outside the 3tchedFS_Views, THE Standalone_Instance SHALL return `EACCES`, `EPERM`, or `EROFS`.
13. WHEN the owner explicitly requests the write-denial check, THE Implementer SHALL attempt one uniquely named file creation under each SHM_State_Tree path visible outside the 3tchedFS_Views and SHALL record the path and returned error.
14. IF a write-denial check succeeds, THEN THE Implementer SHALL stop the check, create a Blocker_Record naming the path and created file, and report the result without making another write.

### Requirement 10: Preserve the lungs-only host boundary

**User Story:** As the owner, I want the Standalone_Instance to use the existing
Lungs_Socket as its only host channel, so that both FUSE views add no new
control plane or inbound door.

#### Acceptance Criteria

1. THE `design.md` document SHALL contain a Channel_Inventory listing every Instance_Spec Device, socket, shared directory, proxy, network path, and 3tchedFS_View surface, with each entry's direction, access mode, owning pinned component, and justification.
2. THE Standalone_Instance SHALL use the Lungs_Socket as its only Host_Channel.
3. THE Standalone_Instance SHALL mount the 3tched_View and the Threetched_View at the same time as guest filesystem surfaces served by 3tched-fs through the existing Lungs_Socket path.
4. THE Instance_Spec SHALL add no host socket, proxy Device, inbound port mapping, shared host directory, direct SHM_State_Tree share, or host API beyond the existing Lungs_Socket directory required by the pinned 3tched-fs interface.
5. IF a selected Visibility_Mechanism requires a Host_Channel other than the Lungs_Socket, THEN THE Implementer SHALL reject the Visibility_Mechanism, create a Blocker_Record naming the additional Host_Channel, and leave the dependent tasks in proposed status.
6. WHILE a Standalone_Instance is running, THE Standalone_Instance SHALL have zero listening TCP or UDP sockets bound to a non-loopback address.
7. THE Hackathon_Repository product code SHALL contain no MCP server, MCP client, or MCP transport.
8. THE Cockpit_Glue_LXD SHALL perform every control action through an existing Operation_File in the action's Matching_View and SHALL implement no additional server, API, command interface, or control plane for op-dbus, LXD, signing, egress, or chain access.
9. WHEN a Standalone_Instance has started, THE Implementer SHALL compare the Devices, mounts, and sockets shown by Authoritative_State and read-only guest inspection with the Channel_Inventory and SHALL create a Blocker_Record naming each observed Host_Channel or listening socket that violates this requirement.

### Requirement 11: Storage model

**User Story:** As the owner, I want the instance's storage model decided and
preserved, so that LXD instances do not quietly break the seed and leaf layout.

#### Acceptance Criteria

1. THE `design.md` document SHALL state, from the owner's decision on Open question 3, whether the Seed, Leaf and Seven_Subvolumes model applies to Standalone_Instances, or SHALL state "awaiting owner decision" and leave every storage-dependent task in proposed status.
2. WHERE the Seed, Leaf and Seven_Subvolumes model applies, THE Provisioning_Procedure_LXD SHALL record the Seed's read-only flag, subvolume UUID and generation before and after creation, and SHALL report creation incomplete unless the read-only flag is set and the UUID and generation are identical in both records.
3. WHERE the Seed, Leaf and Seven_Subvolumes model applies, WHEN creation of a Standalone_Instance completes, THE Provisioning_Procedure_LXD SHALL verify that the Standalone_Instance storage contains exactly the subvolumes `@`, `@agent_memory`, `@agent_rules`, `@agent_shared`, `@agent_skills`, `@agent_soul` and `@agent_user`, with no subvolume missing and no additional subvolume.
4. WHERE the Seed, Leaf and Seven_Subvolumes model applies, IF the subvolume verification finds a missing or additional subvolume, THEN THE Provisioning_Procedure_LXD SHALL report creation incomplete, create a Blocker_Record naming each missing or additional subvolume, and add or remove no subvolume or Btrfs device.
5. WHERE the Seed, Leaf and Seven_Subvolumes model applies, THE Provisioning_Procedure_LXD SHALL add a blank Leaf only through the External_Provisioner, at most once per Standalone_Instance, during explicit creation.
6. WHEN a Lifecycle_Operation_LXD, or a login or logout of the 3tchedW3_Identity, runs on a Standalone_Instance, THE Implementer SHALL record the set of Btrfs member devices before and after the operation and SHALL report the operation incomplete unless the two sets are identical.
7. THE Hackathon_Repository SHALL contain no command that adds or removes a Btrfs device outside the single External_Provisioner creation call.

### Requirement 12: Lifecycle and existing instance preservation

**User Story:** As the owner, I want lifecycle actions and repeated provisioning
to preserve an existing standalone instance, so that no duplicate or reimaged
instance replaces it.

#### Acceptance Criteria

1. THE Cockpit_Glue_LXD SHALL perform each Lifecycle_Operation_LXD through the LXD_Plugin Operation_File in the 3tched_View named for that operation in the sealed schema.
2. IF the sealed schema names no LXD_Plugin method for a Lifecycle_Operation_LXD, THEN THE Implementer SHALL create a Blocker_Record naming the Lifecycle_Operation_LXD and leave the dependent task in proposed status.
3. IF a granted LXD_Plugin state read made at invocation time shows an existing Standalone_Instance bound to the Standalone_Reservation session, THEN THE Provisioning_Procedure_LXD SHALL skip creation and leave that instance's 3tchedW3_Identity, LXD instance UUID, credentials, grants and storage identical to their values before the invocation.
4. WHEN the Provisioning_Procedure_LXD is invoked for a Standalone_Reservation whose session already has a Standalone_Instance, THE Provisioning_Procedure_LXD SHALL report the existing instance name and LXD instance UUID and SHALL perform zero create, delete, rebuild or reimage Operation_File writes.
5. IF an LXD instance with the Standalone_Reservation instance name exists and is bound to a session other than the Standalone_Reservation session, THEN THE Provisioning_Procedure_LXD SHALL perform no Operation_File write on that instance, create a Blocker_Record naming the instance and its session, and stop.
6. IF the invocation-time LXD_Plugin state read is denied, fails or returns an unknown outcome, THEN THE Provisioning_Procedure_LXD SHALL perform no create action and SHALL create a Blocker_Record per Requirement 14.
7. FOR ALL repeated invocations of the Provisioning_Procedure_LXD with the same Standalone_Reservation, THE resulting set of Standalone_Instances, compared by instance name and LXD instance UUID, SHALL equal the set after the first successful invocation (idempotence).

### Requirement 13: 3tched and threetched naming

**User Story:** As the owner, I want every name to follow the rule that
threetched is what runs on the ZeroClaw-derived executable and 3tched is what
runs on our code, so that naming defects in pinned source are not built into
new code.

#### Acceptance Criteria

1. THE Hackathon_Repository code, procedures and verification steps for this spec SHALL call the Threetched_Surface only through `threetched` operation names in the Threetched_View.
2. THE Hackathon_Repository SHALL contain no invocation of, dependency on, or interface reference to `tched_router` or `tched-router`, matched case-insensitively, for this spec, other than Baseline_Record and Blocker_Record entries that describe the naming discrepancy.
3. IF the mounted `/run/mounts/threetched` view in a Standalone_Instance exposes no Threetched_Surface operation under the `threetched` name, including the case where the operation is exposed only under the `tched_router` name, THEN THE Implementer SHALL create a Blocker_Record naming the observed names and leave the dependent tasks in proposed status.
4. THE Hackathon_Repository code, specs, documents and commit messages for this spec SHALL name each component that runs on our code, including op-dbus, the bridge, 3tched-fs, `identity_sled`, the LXD_Plugin and every new component of this spec, with 3tched and not with threetched.
5. THE Hackathon_Repository code, specs, documents and commit messages for this spec SHALL name each component or operation run by `/usr/bin/threetched` with threetched.
6. THE Hackathon_Repository SHALL use `zeroclaw`, matched case-insensitively, as no product, service, component or interface name, and SHALL refer to the executable only descriptively as the ZeroClaw-derived executable `/usr/bin/threetched`.
7. THE Baseline_Record SHALL list each name in `/srv/git/odbus-verified` that contradicts the owner naming rule, including the 3tched-fs source directory `crates/threetched-fs`, its package name `tched-fs`, its library name `tched_fs`, and `tched_router` / `tched-router`, each with file and line, the component it names, and what runs that component.
8. THE Hackathon_Repository SHALL use no name listed under criterion 7 as an interface name, and SHALL cite such a name only as a source location in a Baseline_Record, Blocker_Record or Provenance_Record entry.

### Requirement 14: Denial handling

**User Story:** As the owner, I want denials recorded and escalated, so that
permission boundaries are respected rather than bypassed.

#### Acceptance Criteria

1. WHEN a Denial occurs, THE Implementer SHALL create a Blocker_Record containing the operation (Operation_File path or read-only command), the caller session id and principal id, the missing capability or policy or "not reported", the error text as returned, the UTC timestamp and the identifier of the task that was running.
2. THE Blocker_Record SHALL contain no SID1 bytes, SID1 file contents, digest of a SID1 credential or private key material, and IF returned error text contains such material, THEN THE Implementer SHALL replace that material with the marker `[redacted]` in the Blocker_Record.
3. WHEN a Denial occurs, THE Implementer SHALL stop the running task, SHALL record the Blocker_Record identifier against that task and against every task that `tasks.md` lists as depending on it, and SHALL report the Blocker_Record to the owner in the next Status_Report.
4. IF a Denial occurs, THEN THE Implementer SHALL leave the denied action unperformed by any other route, including direct database edits, direct SHM_State_Tree writes, alternate transports such as the Lungs_Socket, D-Bus or HTTP, another identity including the 3tched_Identity, the other of the 3tchedFS_Views, raw `lxc`, `lxd` or Incus commands, the LXD REST API, and the chain.
5. WHILE a Blocker_Record for a Denial is open, THE Implementer SHALL keep the blocked tasks at the status they had when the Denial occurred, and SHALL resume them only after an Owner_Authorization names the resolution or a later read-only check recorded in the Runtime_Record shows the missing capability present.
6. IF an operation outcome is unknown, THEN THE Implementer SHALL record the outcome as unknown in a Blocker_Record and SHALL first reconcile the outcome with a granted read-only state read of the affected plugin.
7. IF the reconciling state read leaves the outcome unknown, THEN THE Implementer SHALL repeat only the byte-identical argument to the same Operation_File as the same identity, at most once, and SHALL record the second Receipt or error in the same Blocker_Record.
8. IF the outcome remains unknown after the single repeat, THEN THE Implementer SHALL stop the task and report the Blocker_Record to the owner without further writes.

### Requirement 15: Live-change authorization gate

**User Story:** As the owner, I want every live change to need my explicit
authorization, so that discovery and source work cannot alter the running
system.

#### Acceptance Criteria

1. THE `tasks.md` document SHALL mark each task that performs a Live_Change and SHALL name the Live_Change, its target instance or identity, and the Operation_Files it writes.
2. WHEN a task would create, start, stop, restart, reconfigure or delete an LXD instance, or change identities, grants, storage, SHM sharing, mounts or services, THE Implementer SHALL check, before the first Operation_File write of that task, for an Owner_Authorization that names that Live_Change and its target.
3. IF no Owner_Authorization names the Live_Change, THEN THE Implementer SHALL record the planned Operation_File paths, arguments, expected Receipts and expected Authoritative_State, SHALL perform none of the planned writes, and SHALL leave the task in proposed status.
4. IF the target, identity, host, operation or argument of a planned Live_Change differs from what the Owner_Authorization names, THEN THE Implementer SHALL perform none of the planned writes and SHALL ask the owner to confirm the difference.
5. THE Implementer SHALL treat each Owner_Authorization as covering only the Live_Change and target it names.
6. WHILE a task depends on an open question with the status "awaiting owner decision", THE Implementer SHALL leave the task in proposed status even when an Owner_Authorization names its Live_Change.
7. THE Implementer SHALL limit work without Owner_Authorization to read-only discovery and reversible source changes in the Hackathon_Repository.
8. THE Implementer SHALL leave `/srv/git/odbus-verified`, `.kiro/steering/security-boundaries.md` and `.kiro/steering/naming-3tched-threetched.md` unmodified, so that `git status --porcelain` output for `/srv/git/odbus-verified` is identical before and after each task and the `git diff` of each steering file is empty for every commit of this spec.

### Requirement 16: Verification through receipts and authoritative state

**User Story:** As the owner, I want completion proven by receipts and
authoritative state, so that a local write is never reported as success.

#### Acceptance Criteria

1. WHEN an LXD_Plugin operation is reported complete, THE Implementer SHALL attach the Operation_File path, validated argument, Guest_Kernel_Identity, Tracker_Evidence, operation Receipt, and Authoritative_State read back through a separately tracked and granted `lxd` read Operation_File after the operation Terminal_Record.
2. IF Guest_Kernel_Identity, Tracker_Evidence, Receipt, or Authoritative_State is missing, duplicated, invalid, stale, or mismatched, THEN THE Implementer SHALL report the operation incomplete and SHALL accept no SHM_Runtime_Mirror value, local file, log entry, provider response, or chain record in place of the required evidence.
3. WHEN a Standalone_Instance is created, THE Implementer SHALL verify from Authoritative_State that the instance type is `container`, `security.privileged` is `false`, `security.nesting` is `false`, `boot.autostart` is `false`, the Device set equals the Instance_Spec Device set by name, type and properties, and the bound session id equals the Standalone_Reservation session.
4. WHEN a Standalone_Instance has started, THE Implementer SHALL verify the 3tched_View and the Threetched_View from inside the instance through the 3tched-fs binary command `3tched-fs describe --guest-kernel`, distinct kernel mount sources, the same catalog hash and generation, and one granted read per view, each of a plugin that the View_Assignment places in that view, whose Receipt is attributed to the Standalone_Reservation session.
5. WHEN a Standalone_Instance has started, THE Implementer SHALL record, for each view whose SHM_Read_Path Requirement 3 criterion 1 traced to the SHM_State_Tree, the plugin name, generation and sha256 digest of the present state of one plugin read through that view and of the same plugin state read from the SHM_State_Tree on the host, and SHALL report the view verification as passed only when the generations and digests are equal.
6. IF a verification read is denied or returns an unknown outcome, THEN THE Implementer SHALL report the verification as incomplete and handle the Denial under Requirement 14.
7. WHEN a verification step fails, THE Implementer SHALL record the expected value, the observed value and the source of the observed value, and SHALL leave the component at the last status whose evidence is complete.
8. IF a verification read for a plugin is made in a view other than the plugin's Matching_View, THEN THE Implementer SHALL discard the read as evidence and report the verification as incomplete.

### Requirement 17: Build, check and status reporting

**User Story:** As the owner, I want builds scoped and status reported by stage,
so that the shared host is not disrupted and proposed work is never mistaken
for deployed work.

#### Acceptance Criteria

1. WHEN a build is required, THE Implementer SHALL build only the required scoped package for `--target x86_64-unknown-linux-gnu` and SHALL run no workspace-wide Cargo command without an explicit owner workspace request.
2. THE Implementer SHALL run tests, Clippy, formatting checks and smoke fixtures only on explicit owner request.
3. WHILE one Cargo process is running, THE Implementer SHALL start no other Cargo process, and SHALL check for a running Cargo process before starting one.
4. THE Status_Report SHALL state proposed, implemented, built, tested and deployed status as separate fields for each component and each task of this spec, and SHALL mark a field as not reached when its required evidence is absent.
5. THE Status_Report SHALL list, for each task in proposed status, the open question numbers that `tasks.md` lists for the task, every open Blocker_Record holding the task, and every missing Owner_Authorization.
6. WHEN a component is reported built, THE Status_Report SHALL cite the build command, the target triple and the exit status.
7. WHEN a component is reported tested, THE Status_Report SHALL cite the explicit owner request, the test command and its output including the exit status.
8. WHEN a component is reported deployed, THE Status_Report SHALL cite the Owner_Authorization, Guest_Kernel_Identity, Tracker_Evidence, deployment Receipt, and Authoritative_State evidence required by Requirements 16, 25, and 27.
9. THE Status_Report SHALL name each component under the naming rule of Requirement 13, naming 3tched-fs as 3tched-fs and citing its pinned source directory `crates/threetched-fs` and package name `tched-fs` only as source locations.

### Requirement 18: Provenance and commits

**User Story:** As a judge, I want the LXD standalone work traceable and
separable, so that I can tell pre-existing components from hackathon work.

#### Acceptance Criteria

1. THE Provenance_Record SHALL list the LXD_Plugin, 3tched-fs (pinned source path `crates/threetched-fs`, recorded as a naming defect under Requirement 13 criterion 7), the session derivation in `crates/op-identity/src/session.rs` and every other pre-existing component used by this spec with its path, pinned commit or recorded working-tree digest, and git status, matching the values recorded in the Baseline_Record.
2. WHILE Open question 4 has the status "awaiting owner decision", THE Provenance_Record SHALL mark the LXD_Plugin as "provenance awaiting owner decision" and cite the Blocker_Record created under Requirement 2 criterion 9.
3. THE Provenance_Record SHALL list each new component of this spec, including Standalone_Reservation, Standalone_Reservation validator, Instance_Spec, Instance_Spec validator, Provisioning_Procedure_LXD, Cockpit_Glue_LXD, Tool_Executor, Web3_Mirror, Attestation_Deriver, Attestation_Codec, Chain_Submitter, and Submission_Package, with the component path and `tasks.md` task identifiers that produced the component.
4. THE Implementer SHALL make each commit in the Hackathon_Repository focused on one spec task or one record and SHALL name that task identifier or record in the commit message.
5. THE Implementer SHALL create each commit with author and committer dates equal to its actual creation time, on or after 2026-10-30, without overriding either date.
6. THE Implementer SHALL include in hackathon commits no commit history dated before 2026-10-30 and no file copied from a pre-existing component.
### Requirement 19: Keep the sealed 3tchedW3 identity authoritative

**User Story:** As a verifier, I want the Web3 side to mirror the sealed
3tchedW3 identity, so that chain state cannot become a second source of truth.

#### Acceptance Criteria

1. THE Web3_Mirror SHALL derive every published identity field from public Sealed_Identity fields of the 3tchedW3_Identity read through a granted `identity_sled` Operation_File in the 3tched_View.
2. THE Web3_Mirror SHALL limit every effect on the Sealed_Identity, grants, Receipts, and Audit_Chain to granted read operations.
3. WHEN published mirror state is evaluated, THE Web3_Mirror SHALL compare the published commitment with the current public Sealed_Identity fields read through a granted Operation_File.
4. IF published mirror state differs from the current public Sealed_Identity fields, THEN THE Web3_Mirror SHALL report the Sealed_Identity as authoritative and mark the mirror state stale.
5. THE Web3_Mirror SHALL provide a verification procedure that reports match or mismatch for an Attestation, the corresponding public Sealed_Identity fields, the included Receipt projections, the Audit_Chain segment, and optional Chain_Authoritative_State.
6. THE Web3_Mirror SHALL create no identity, grant, credential, Receipt, Audit_Chain, or Authoritative_State value from chain data.

### Requirement 20: Bind attestations without hardware or SID1 material

**User Story:** As the owner, I want 3tchedW3 attestations bound only to public
identity and execution evidence, so that the identity remains portable and no
sealed credential is exposed or anchored.

#### Acceptance Criteria

1. THE Attestation_Deriver SHALL accept as identity-binding inputs only the 3tchedW3_Identity public key, principal id, session id, genesis, Catalog_Pin, Receipt digests, and Audit_Chain hashes.
2. IF an Attestation_Deriver input contains a Hardware_Identifier, THEN THE Attestation_Deriver SHALL reject the input with an error naming the field.
3. WHEN the Attestation_Deriver receives identical valid inputs on different hosts, THE Attestation_Deriver SHALL produce identical canonical Attestation bytes.
4. THE Attestation_Deriver SHALL compute Anchored_Data only from existing attributed Receipts, verified Tracker_Evidence, a valid Audit_Chain segment, and public Sealed_Identity fields.
5. IF an Attestation_Deriver input contains SID1 bytes, a SID1 substring, a digest computed from SID1 bytes, private key material, or another non-public identity field, THEN THE Attestation_Deriver SHALL reject the whole input and omit the rejected value from the error.
6. THE Attestation_Deriver output SHALL contain no SID1 bytes, SID1 substring, digest computed from SID1 bytes, private key material, or non-public identity field.
7. WHEN one included Receipt, Execution_Hash_Chain_Linkage value, or public identity field changes, THE Attestation_Deriver SHALL produce a different Attestation digest.
8. WHEN an Audit_Chain segment contains a preceding-record hash that differs from the preceding record hash, THE Attestation_Deriver SHALL reject the segment and report the first mismatching position.
9. THE Chain_Submitter SHALL publish Anchored_Data without modifying the source Sealed_Identity, Tracker_Evidence, Receipts, or Audit_Chain.

### Requirement 21: Encode attestations canonically

**User Story:** As a verifier, I want one canonical Attestation byte form, so
that independent implementations compute the same digest.

#### Acceptance Criteria

1. THE `design.md` document SHALL define the Attestation grammar, canonical encoding, field order, allowed fields, digest algorithm, domain separator, and malformed-input error format.
2. THE Attestation_Codec SHALL encode each valid Attestation into the canonical byte form specified in `design.md`.
3. WHEN valid canonical bytes are provided, THE Attestation_Codec SHALL decode the bytes into one Attestation.
4. IF malformed, ambiguous, duplicate-field, unknown-field, or non-canonical bytes are provided, THEN THE Attestation_Codec SHALL return an error identifying the failing field or byte offset.
5. WHEN a valid Attestation is encoded, decoded, and encoded again, THE Attestation_Codec SHALL produce byte-identical output.
6. WHEN valid canonical bytes are decoded, encoded, and decoded again, THE Attestation_Codec SHALL produce an equivalent Attestation.

### Requirement 22: Keep Web3 keys sealed inside the 3tchedW3 identity

**User Story:** As the owner, I want Web3 signing keys confined to the sealed
3tchedW3 identity, so that the host, repository, logs, and chat never receive a
usable private key.

#### Acceptance Criteria

1. THE W3_Key SHALL be generated, stored, and used only inside sealed storage assigned to the 3tchedW3_Identity.
2. WHEN a Chain_Submission requires a signature, THE Chain_Submitter SHALL invoke the Signing_Operation through its Operation_File in the 3tched_View as the Guest_Kernel_Identity.
3. WHEN a Signing_Operation succeeds, THE Signing_Operation SHALL return only the signature, public key or public signer address, signed payload digest, Receipt, and operation identifiers.
4. THE Signing_Operation SHALL export no private key, seed phrase, SID1 credential, session credential, or reusable signing secret.
5. IF a signing result, log item, error, model context item, UI item, Runtime_Record, Blocker_Record, or Submission_Package item contains W3_Key material or SID1 material, THEN THE producing component SHALL block the whole item before any byte reaches the destination.
6. THE Hackathon_Repository SHALL contain no private key, seed phrase, SID1 credential, funded-key credential, or usable signing secret.
7. THE Implementer SHALL provide a repository credential check that reports only the credential class, file path, and location without reporting the matched value.
8. IF the Signing_Operation is absent from the sealed catalog, unavailable in the 3tched_View, or not granted to the 3tchedW3_Identity, THEN THE Chain_Submitter SHALL leave the Chain_Submission unsigned and create a Blocker_Record.

### Requirement 23: Record chain decisions and enforce testnet-only targets

**User Story:** As the owner, I want chain choices explicit and testnet-gated,
so that no chain call can silently reach mainnet or spend funded tokens.

#### Acceptance Criteria

1. THE `design.md` document SHALL name the selected chain, testnet network, exact numeric Testnet_Allowlist, attestation contract or standard, canonical encoding, Signing_Operation, Egress_Path, submission Operation_File, and chain-read Operation_File, with alternatives and selection reasons.
2. WHILE a chain, testnet network, contract or standard, Signing_Operation, Egress_Path, submission operation, or chain-read operation decision is absent, THE Implementer SHALL leave every dependent Chain_Submission task in proposed status.
3. WHEN a Chain_Submission is requested, THE Chain_Submitter SHALL obtain the target chain identifier from the validated request and compare the identifier with the exact numeric Testnet_Allowlist before signing or egress.
4. IF the target chain identifier is absent from the Testnet_Allowlist, THEN THE Chain_Submitter SHALL refuse the Chain_Submission and create a Blocker_Record naming the rejected chain identifier without invoking signing, egress, or chain operations.
5. IF a Chain_Submission requires a mainnet deployment, token spend, or signature from a funded key, THEN THE Chain_Submitter SHALL refuse the Chain_Submission unless an Owner_Authorization names the exact chain, network, amount, key identity, operation, and target.
6. THE Testnet_Allowlist SHALL change only through a reviewed Hackathon_Repository source change and a matching Owner_Authorization.
7. THE Chain_Submitter SHALL accept no chain identifier supplied only by an RPC endpoint, wallet, provider default, symbolic alias, or environment override.

### Requirement 24: Submit chain attestations through existing operation files

**User Story:** As the owner, I want signing, egress, submission, and chain
reads to use existing attributed operation files, so that Web3 work adds no
transport, control plane, or inbound network door.

#### Acceptance Criteria

1. THE Chain_Submitter SHALL invoke signing, Egress_Path, chain submission, and chain-read actions only through granted Operation_Files in each action's Matching_View.
2. THE Chain_Submitter SHALL validate each Chain_Submission field against the sealed catalog argument schema from the same Catalog_Pin used to select the Operation_File.
3. THE Chain_Submitter SHALL send chain traffic only through the existing outbound-only Egress_Path named in `design.md`.
4. THE Chain_Submitter SHALL open no listening socket and SHALL add no proxy, host socket, shared directory, network interface, MCP component, or alternate control plane.
5. IF no permitted existing Egress_Path is exposed through a granted Operation_File, THEN THE Implementer SHALL create a Blocker_Record and leave chain signing and submission tasks in proposed status.
6. WHEN a Chain_Submission is reported complete, THE Chain_Submitter SHALL provide matching Tracker_Evidence, the submission Receipt, and Chain_Authoritative_State read through the granted chain-read Operation_File after the submission Terminal_Record.
7. WHEN Chain_Authoritative_State is evaluated, THE Chain_Submitter SHALL require equality with the Chain_Submission for target chain id, payload or Attestation digest, signer public identity, contract or standard identifier, and transaction or attestation identifier.
8. IF Tracker_Evidence, the Receipt, or Chain_Authoritative_State is absent, duplicated, invalid, stale, or mismatched, THEN THE Chain_Submitter SHALL report the Chain_Submission incomplete and create a Blocker_Record.
9. THE Chain_Submitter SHALL accept no provider response, local log, SHM_Runtime_Mirror value, UI state, model output, or transaction broadcast acknowledgement as completion evidence.

### Requirement 25: Route every tool call through op-execution-tracker

**User Story:** As the owner, I want every read and mutation in both mounted
views recorded by the existing execution tracker, so that no LXD, identity,
threetched, signing, egress, or chain action bypasses attributed execution
evidence.

#### Acceptance Criteria

1. THE Tool_Executor SHALL route every Read_Tool_Call and every Mutation_Tool_Call in the 3tched_View and the Threetched_View through Operation_File dispatch and the existing op-execution-tracker path.
2. THE Tool_Executor SHALL apply criterion 1 to every LXD, `identity_sled`, threetched, signing, egress, chain-submission, chain-read, lifecycle, discovery, verification, and other read Tool_Call.
3. WHEN a Tool_Call enters backend execution, THE op-execution-tracker SHALL create one Attempt_Record before the backend produces a terminal outcome.
4. THE Attempt_Record SHALL identify the Tool_Call by `operation_id`, caller identity, caller session, plugin, method, `subid`, Catalog_Pin hash, Catalog_Pin generation, and Execution_Hash_Chain_Linkage.
5. WHEN backend execution reaches a terminal outcome, THE op-execution-tracker SHALL create exactly one Terminal_Record for the Tool_Call `operation_id`.
6. THE Terminal_Record SHALL identify the Tool_Call by `operation_id`, caller identity, caller session, plugin, method, `subid`, Catalog_Pin hash, Catalog_Pin generation, outcome, and Execution_Hash_Chain_Linkage.
7. WHEN a Receipt is returned, THE Receipt SHALL link to the Attempt_Record and the single Terminal_Record for the same `operation_id`.
8. WHEN Tracker_Evidence is evaluated, THE Tool_Executor SHALL require exact equality among the Tool_Call, Attempt_Record, Terminal_Record, and Receipt for `operation_id`, caller identity, caller session, plugin, method, `subid`, Catalog_Pin hash, and Catalog_Pin generation.
9. WHEN Tracker_Evidence is evaluated, THE Tool_Executor SHALL require the Terminal_Record outcome to equal the Receipt outcome and SHALL require valid Execution_Hash_Chain_Linkage for the Attempt_Record and Terminal_Record.
10. IF the Attempt_Record is missing, duplicated, or created after terminal backend execution, THEN THE Tool_Executor SHALL report the Tool_Call incomplete and create a Blocker_Record.
11. IF the Terminal_Record is missing or more than one Terminal_Record matches the `operation_id`, THEN THE Tool_Executor SHALL report the Tool_Call incomplete and create a Blocker_Record.
12. IF any attribution, Catalog_Pin, outcome, `operation_id`, or Execution_Hash_Chain_Linkage value is missing, invalid, or mismatched, THEN THE Tool_Executor SHALL report the Tool_Call incomplete and create a Blocker_Record.
13. IF Tracker_Evidence is incomplete, duplicated, or mismatched, THEN THE Tool_Executor SHALL make no retry or fallback through another Operation_File, mounted view, transport, identity, direct backend call, SHM_State_Tree write, raw LXD interface, Egress_Path call, provider call, or chain call.
14. THE Tool_Executor SHALL accept no local file, SHM_Runtime_Mirror value, log, UI state, process exit status, provider response, or model output as a substitute for Tracker_Evidence.

### Requirement 26: Trace the complete tracked operation path

**User Story:** As the owner, I want the complete operation path established
from pinned source, so that tracker enforcement, Receipt linkage, and
Authoritative_State read-back are demonstrated rather than inferred from FUSE
files.

#### Acceptance Criteria

1. THE Baseline_Record SHALL trace an Operation_File write from the 3tched-fs write handler into the PluginV1_Path.
2. THE Baseline_Record SHALL trace the PluginV1_Path through lungs dispatch and into backend plugin dispatch.
3. THE Baseline_Record SHALL trace backend plugin dispatch into op-execution-tracker Attempt_Record creation before backend terminal execution.
4. THE Baseline_Record SHALL trace backend completion into exactly one op-execution-tracker Terminal_Record.
5. THE Baseline_Record SHALL trace the Terminal_Record into Receipt construction and the Receipt from backend dispatch to the result read from the same Operation_File.
6. THE Baseline_Record SHALL trace the owning plugin's granted read method from its Operation_File through PluginV1, lungs, backend dispatch, op-execution-tracker, Receipt return, and Authoritative_State result.
7. THE Baseline_Record SHALL record each trace step with repository pin, relative file path, one-based line number, symbol, caller, callee, and preserved fields.
8. THE Baseline_Record SHALL identify the source location that preserves `operation_id`, caller identity, caller session, plugin, method, `subid`, Catalog_Pin hash, Catalog_Pin generation, outcome, and Execution_Hash_Chain_Linkage at each applicable trace step.
9. THE Baseline_Record SHALL perform the complete trace separately for one LXD call, one `identity_sled` call, one threetched call, one Signing_Operation, one Egress_Path call, one chain-submission call, and one chain-read call used by this spec.
10. IF two operation families share a dispatch path, THEN THE Baseline_Record SHALL cite the common trace once and record the family-specific entry, backend dispatch, result, and Authoritative_State read-back locations separately.
11. IF a trace step cannot be established from pinned source, THEN THE Implementer SHALL create a Blocker_Record naming the operation family, Matching_View, last established symbol, and unresolved transition.
12. WHILE a trace step remains unresolved, THE Implementer SHALL report Tool_Calls in the affected operation family as deployment-unconfirmed and leave dependent mutation tasks in proposed status.
13. THE Implementer SHALL perform source tracing with read-only operations that leave pinned dependency working trees, indexes, refs, and configuration unchanged.

### Requirement 27: Require tracker, receipt, and authoritative state for completion

**User Story:** As the owner, I want each operation completed by attributed
execution and authoritative read-back, so that a mounted projection observation
or successful write alone cannot be reported as deployment.

#### Acceptance Criteria

1. WHEN a Tool_Call is reported complete, THE Tool_Executor SHALL provide the Guest_Kernel_Identity, valid Tracker_Evidence, matching Operation_File Receipt, and Authoritative_State read after the Tool_Call Terminal_Record.
2. WHEN Authoritative_State is read for completion, THE Tool_Executor SHALL perform the read as a separate Read_Tool_Call through the owning plugin's granted Operation_File in the Matching_View and SHALL require Requirement 25 evidence for that read.
3. WHEN a Tool_Call changes state, THE Authoritative_State SHALL reflect the outcome and affected values recorded by the Terminal_Record and Receipt.
4. IF Guest_Kernel_Identity, Tracker_Evidence, Receipt, or Authoritative_State is absent, duplicated, invalid, stale, or mismatched, THEN THE Tool_Executor SHALL report the Tool_Call incomplete.
5. IF a Tool_Call returns no valid Receipt or single matching Terminal_Record, THEN THE Tool_Executor SHALL classify the Tool_Call as Unknown_Outcome.
6. WHEN a Tool_Call enters Unknown_Outcome, THE Tool_Executor SHALL read op-execution-tracker records for the same `operation_id` and Authoritative_State through granted Operation_Files in the Matching_View.
7. IF Unknown_Outcome reconciliation establishes one valid Attempt_Record, exactly one matching Terminal_Record, a matching Receipt, and matching Authoritative_State, THEN THE Tool_Executor SHALL classify the Tool_Call according to the Terminal_Record outcome.
8. IF Unknown_Outcome reconciliation leaves evidence absent, duplicated, invalid, or mismatched, THEN THE Tool_Executor SHALL keep the Tool_Call incomplete, create a Blocker_Record, and send no repeat execution.
9. THE Tool_Executor SHALL accept no alternate view, transport, identity, direct store, raw LXD command, direct provider request, direct chain request, SHM_Runtime_Mirror value, or local cache for completion or Unknown_Outcome reconciliation.

### Requirement 28: Produce the standalone 3tchedW3 submission package

**User Story:** As a hackathon judge, I want submission evidence owned by the
standalone 3tchedW3 subsidiary, so that the main 3tched control-plane cockpit is
not presented as hackathon implementation.

#### Acceptance Criteria

1. THE Submission_Package SHALL identify the Standalone_Instance, 3tchedW3_Identity public identity, source commit range within the Submission_Window, new hackathon components, and pinned pre-existing dependencies.
2. THE Submission_Package SHALL identify the main 3tched identity, Main_Session, `CockpitBot3tched`, and Reserved_Main_Names only as excluded pre-existing assets that this spec leaves untouched.
3. THE Submission_Package SHALL include the Provenance_Record, Status_Report, open Blocker_Records, selected testnet decisions, Egress_Path decision, credential-safety statement, and no-MCP and no-new-control-plane statement.
4. WHEN the Submission_Package reports the Standalone_Instance deployed, THE Submission_Package SHALL cite Guest_Kernel_Identity, Tracker_Evidence, Receipt, and Authoritative_State for LXD creation or preserved-instance selection, identity binding, one call in each mounted view, and each demonstrated Web3 operation family.
5. WHEN the Submission_Package reports a Chain_Submission complete, THE Submission_Package SHALL cite the testnet chain id, Attestation digest, attributed Tracker_Evidence, submission Receipt, and matching Chain_Authoritative_State.
6. IF required deployment or chain evidence is absent, THEN THE Submission_Package SHALL label the affected claim proposed, implemented, built, tested, deployment-unconfirmed, or blocked according to the evidence available.
7. THE Submission_Package SHALL contain no SID1 material, SID1 digest, W3_Key material, funded-key credential, private endpoint credential, or secret-bearing error text.
8. THE Submission_Package SHALL attribute no implementation, deployment, Web3 mirror, attestation, key custody, egress, chain submission, or demo result of the existing main 3tched control-plane cockpit to the standalone 3tchedW3 subsidiary.
# Requirements Document

## Introduction

This spec covers building the 3tchedW3 cockpit as standalone LXC system
containers created through the op-dbus LXD state plugin. Each Standalone_Instance
reaches the backend through our FUSE filesystem `3tched-fs`, which serves two
guest views with one sealed catalog and one identity enforcement.

The two views are split by the owner naming rule in
`.kiro/steering/naming-3tched-threetched.md`: "threetched is anything that runs
on the zeroclaw backed binary. 3tched is anything that runs on our code."

- The 3tched_View `/run/mounts/3tchedFS` exposes only operations and state that
  run on our code: op-dbus plugin methods, including `lxd` and `identity_sled`.
- The Threetched_View `/run/mounts/threetched` exposes only operations run by
  the ZeroClaw-derived executable `/usr/bin/threetched`, under the `threetched`
  plugin.

The view a call is made in is chosen by what runs the operation, never by
convenience, and a call is never moved to the other view after a Denial or
error.

The guest-facing contract is filesystem I/O only. Processes in the instance use
ordinary filesystem calls (open, read, write, readdir, stat) on the mounted FUSE
views. 3tched-fs serves present state directly from the SHM state tree
(`/dev/shm/opdbus/state`). The guest runs no socket client for backend access,
and this spec does not treat any socket, including the Lungs_Socket, as the FUSE
data path. This spec does not assume what backs the Threetched_View;
Requirement 3 traces the read and call paths of each view separately.

This spec is separate from `.kiro/specs/cockpit-container/` (Incus-based
cockpit). It does not modify that spec. Web3 mirror, attestation, key custody,
chain gating and egress requirements are defined there (cockpit-container
Requirements 4 to 11) and apply to this spec by reference; this spec does not
restate them. The chat interface is defined in
`.kiro/specs/identity-chat-interface/`.

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
  established; no 3tchedW3_Identity has been observed (cockpit-container
  discovery).
- Owner correction: the threetched view is addressed as `threetched`, never
  `tched_router` (cockpit-container Requirement 25). `tched_router` /
  `tched-router` is a naming defect in pinned source for the Threetched_Surface.
- Which plugins 3tched-fs places in the 3tched_View and which in the
  Threetched_View, and what backs the Threetched_View, were not established at
  spec time. Requirement 3 requires tracing both.

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
5. **SHM visibility mechanism.** Whether the 3tched-fs daemon runs host-side
   and its 3tched_View and Threetched_View mounts are passed into the instance,
   or the SHM state tree is shared into the instance for an in-instance 3tched-fs
   daemon, or another mechanism.
6. **Host channel rule.** The steering file names the Lungs_Socket as the
   container's only host channel. A 3tched-fs mount or SHM share is a further
   host-to-instance path. The owner decides how the rule applies.

## Glossary

Terms reused from `.kiro/specs/cockpit-container/requirements.md` keep their
meaning there: **3tched_Identity**, **3tchedW3_Identity**, **Sealed_Identity**,
**SID1**, **Receipt**, **Authoritative_State**, **Operation_File**, **Denial**,
**Blocker_Record**, **Owner_Authorization**, **Live_Change**, **Seed**,
**Leaf**, **Seven_Subvolumes**, **Status_Report**, **Reserved_Main_Names**,
**Main_Session**, **Hardware_Identifier**, **Lungs_Socket**,
**External_Provisioner**, **Baseline_Record**, **Runtime_Record**,
**Provenance_Record**, **Hackathon_Repository**, **Implementer**,
**Submission_Window**.

Terms redefined for this spec: the definitions below of **3tchedFS_Views** and
**Threetched_Surface** apply the owner naming rule in
`.kiro/steering/naming-3tched-threetched.md`. Where they differ from the
cockpit-container meaning, the definitions here supersede it for this spec, as
that steering file requires.

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
- **SHM_Read_Path**: The traced code path by which the FUSE_Daemon serves a
  read on one of the 3tchedFS_Views from its backing state. One SHM_Read_Path
  is traced per view.
- **Call_Path**: The traced code path by which the FUSE_Daemon handles a write
  to an Operation_File in one of the 3tchedFS_Views and returns its Receipt.
  One Call_Path is traced per view.
- **View_Assignment**: The traced rule in 3tched-fs source that decides which
  plugins and operations each of the 3tchedFS_Views exposes.
- **Visibility_Mechanism**: The design-selected means by which a
  Standalone_Instance's 3tchedFS_Views are backed by the SHM_State_Tree.
- **Guest_Process**: Any process running inside a Standalone_Instance.
- **Guest_Backend_Access**: Any interaction of a Guest_Process with the op-dbus
  backend.
- **Host_Channel**: Any path by which data passes between a Standalone_Instance
  and the host, including FUSE mounts, shared directories, sockets and devices.
- **Channel_Inventory**: The design-time list of every Host_Channel of a
  Standalone_Instance with its direction, owner and justification.
- **Provisioning_Procedure_LXD**: The hackathon procedure that creates a
  Standalone_Instance by calling LXD_Plugin Operation_Files.
- **Lifecycle_Operation_LXD**: Start, stop, restart, recovery or failed-start
  cleanup of a Standalone_Instance.
- **Cockpit_Glue_LXD**: The hackathon code inside a Standalone_Instance that
  connects the 3tchedW3 chatbot to operations through the 3tchedFS_Views. The
  Cockpit_Glue_LXD runs on our code and is named 3tched.

## Requirements

### Requirement 1: Separate spec scope

**User Story:** As the owner, I want the LXD standalone cockpit in its own spec,
so that it does not alter the Incus-based cockpit-container spec.

#### Acceptance Criteria

1. THE Implementer SHALL keep the requirements, design and tasks documents of this spec, and every Baseline_Record, Runtime_Record and Blocker_Record created for it, in `.kiro/specs/cockpit-lxd-standalone/`.
2. THE Implementer SHALL make no commit for this spec that adds, modifies, deletes or renames any file under `.kiro/specs/cockpit-container/`, so that the `git diff` of that directory between the commit before this spec's first commit and the latest commit of this spec is empty.
3. WHERE a requirement of this spec concerns the Web3 mirror, attestation, key custody, chain gating or chain egress, THE Implementer SHALL cite the governing cockpit-container requirement by number (Requirements 4 to 11) and SHALL apply that requirement's acceptance criteria as written, without restating or altering them in this spec.
4. IF a statement in this spec, or in a cockpit-container requirement applied by reference, differs from `.kiro/steering/security-boundaries.md`, THEN THE Implementer SHALL follow `.kiro/steering/security-boundaries.md`.

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
assignment traced in source for each view, so that the design rests on
implemented behaviour rather than assumption.

#### Acceptance Criteria

1. THE Baseline_Record SHALL record one SHM_Read_Path for the 3tched_View and one SHM_Read_Path for the Threetched_View, each as an ordered sequence of source locations given as file path relative to the repository root, 1-based line number and function name, in the 3tched-fs source at `crates/threetched-fs` at the HEAD commit recorded under Requirement 2, starting at the FUSE read handler for a file in that view and ending at the read of the state that backs the view, and SHALL name that backing state for each view (the SHM_State_Tree or another named source).
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
9. THE Hackathon_Repository SHALL describe the FUSE data path as filesystem I/O served from the SHM_State_Tree and SHALL describe no socket, including the Lungs_Socket, as the guest's FUSE data path.
10. THE Cockpit_Glue_LXD SHALL use the kernel-bound caller identity of the Standalone_Instance, and neither the Cockpit_Glue_LXD source nor the command line of any Cockpit_Glue_LXD process SHALL contain a SID1 file path or a `--lungs-session` value.
11. IF an operation that the Cockpit_Glue_LXD needs is not exposed as an Operation_File in its Matching_View, THEN THE Implementer SHALL create a Blocker_Record naming the operation and its Matching_View and SHALL perform the operation through no other route, including the other view.
12. THE Cockpit_Glue_LXD SHALL make each call to an operation that runs on our code, including `lxd` and `identity_sled` methods, under `/run/mounts/3tchedFS/operations/`, and each call to an operation run by `/usr/bin/threetched` under `/run/mounts/threetched/operations/threetched/`.
13. IF a call in the Matching_View is denied or returns an error, THEN THE Cockpit_Glue_LXD SHALL make no call for that operation through the other view, and THE Implementer SHALL handle the Denial or error under Requirement 14.
14. IF the View_Assignment recorded under Requirement 3 criterion 9 does not determine the Matching_View of an operation, THEN THE Cockpit_Glue_LXD SHALL make no call for that operation, and THE Implementer SHALL create a Blocker_Record naming the operation.
15. IF Requirement 3 criterion 1 records that a view is backed by state other than the SHM_State_Tree, THEN THE Implementer SHALL create a Blocker_Record naming the view and its recorded backing state, and SHALL leave every task that reads present state through that view in proposed status.

### Requirement 9: SHM visibility mechanism

**User Story:** As the owner, I want the way SHM state reaches the instance's
FUSE views chosen explicitly, so that the guest never gains raw write access to
backend state.

#### Acceptance Criteria

1. THE `design.md` document SHALL name the selected Visibility_Mechanism and each alternative considered, including at least the two candidates of Open question 5, and SHALL give for each the reason for selection or rejection, citing the SHM_Read_Path source locations recorded for both views under Requirement 3.
2. WHILE Open question 5 has the status "awaiting owner decision", or the SHM_Read_Path of either view is untraced under Requirement 3 criterion 7, THE `design.md` document SHALL record the Visibility_Mechanism as "not selected" and THE Implementer SHALL leave every task that depends on the Visibility_Mechanism in proposed status.
3. THE `design.md` document SHALL state, for each of the eight enforcement locations recorded under Requirement 3 criterion 4, how the selected Visibility_Mechanism keeps that enforcement on the path of every Guest_Process read and write on both 3tchedFS_Views.
4. IF Requirement 3 criterion 4 recorded "no enforcement found" for an entry, or the selected Visibility_Mechanism would route a Guest_Process read or write around an enforcement location, THEN THE Implementer SHALL create a Blocker_Record naming the entry and leave the dependent tasks in proposed status.
5. IF a Visibility_Mechanism would give a Guest_Process write access to the SHM_State_Tree outside the FUSE_Daemon, THEN THE Instance_Spec validator SHALL reject the Visibility_Mechanism and name the Device or mount that grants the write access.
6. WHERE the Visibility_Mechanism shares the SHM_State_Tree into the Standalone_Instance, THE Instance_Spec SHALL mount the SHM_State_Tree read-only, and THE Implementer SHALL verify after start, from the Authoritative_State of the instance and from the mount options seen inside the instance, that the mount is read-only.
7. WHERE the Visibility_Mechanism passes a host-side 3tched-fs mount into the Standalone_Instance, THE Instance_Spec SHALL record the FUSE_Daemon's process user, the session id it is bound to and the source location of that binding.
8. WHERE the Visibility_Mechanism passes a host-side 3tched-fs mount into the Standalone_Instance, IF the session id bound to the FUSE_Daemon differs from the Standalone_Reservation session, THEN THE Implementer SHALL create a Blocker_Record naming both session ids and leave the dependent tasks in proposed status.
9. FOR ALL Guest_Process write attempts on SHM_State_Tree paths outside the 3tchedFS_Views, THE Standalone_Instance SHALL return a permission error (`EACCES` or `EPERM`) or a read-only error (`EROFS`).
10. WHEN the owner explicitly requests the write-denial check, THE Implementer SHALL attempt to create one new uniquely named file under each SHM_State_Tree path visible to a Guest_Process outside the 3tchedFS_Views and SHALL record the path and returned error for each attempt.
11. IF a write-denial check attempt succeeds, THEN THE Implementer SHALL make no further write, create a Blocker_Record naming the path and the created file, and report the result to the owner.

### Requirement 10: Host channel reconciliation

**User Story:** As the owner, I want every host channel of the instance listed
and checked against the steering rule, so that a conflict is decided by me
rather than resolved silently.

#### Acceptance Criteria

1. THE `design.md` document SHALL contain a Channel_Inventory listing every Host_Channel of a Standalone_Instance, covering every Instance_Spec Device entry, every 3tched-fs mount of the 3tched_View and the Threetched_View, every shared directory and every socket, with for each entry its direction (host-to-instance, instance-to-host or bidirectional), access mode (read-only or read-write), pre-existing owning component and justification.
2. THE Channel_Inventory SHALL mark each Host_Channel as either "conforms" or "conflicts" with the steering rule that the Lungs_Socket is the container's only host channel, and SHALL mark every Host_Channel other than the Lungs_Socket as "conflicts".
3. IF a Host_Channel other than the Lungs_Socket is required, including a 3tched-fs mount or SHM_State_Tree share, THEN THE Implementer SHALL create one Blocker_Record per such Host_Channel naming the Host_Channel and the steering rule, and SHALL leave the dependent tasks in proposed status until an Owner_Authorization decides the conflict.
4. WHILE a Standalone_Instance is running, THE Standalone_Instance SHALL have zero listening TCP or UDP sockets bound to any non-loopback address.
5. THE Hackathon_Repository product code SHALL contain no MCP server, MCP client or MCP transport.
6. THE Cockpit_Glue_LXD SHALL perform every control action as a write to an existing Operation_File in the action's Matching_View and SHALL implement no other server, API or command interface for controlling op-dbus or the Standalone_Instance.
7. WHEN a Standalone_Instance has started, THE Implementer SHALL compare the Devices and mounts shown in the Authoritative_State of the instance with the Channel_Inventory and SHALL create a Blocker_Record naming each observed Host_Channel that is absent from the Channel_Inventory.

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
3. IF the mounted `/run/mounts/threetched` view in a Standalone_Instance exposes no Threetched_Surface operation under the `threetched` name, including the case where it is exposed only under the `tched_router` name, THEN THE Implementer SHALL create a Blocker_Record per cockpit-container Requirement 25 naming the observed names and leave the dependent tasks in proposed status.
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

1. WHEN an LXD_Plugin operation is reported complete, THE Implementer SHALL attach the Operation_File path, the argument, the caller session id, the operation Receipt, and the Authoritative_State read back through a granted `lxd` state read made after the Receipt was returned.
2. IF a Receipt is missing, the Receipt indicates failure, or the Authoritative_State does not reflect the operation, THEN THE Implementer SHALL report the operation as incomplete and SHALL accept no local file, log entry or chain record in place of the Receipt or the Authoritative_State.
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
8. WHEN a component is reported deployed, THE Status_Report SHALL cite the Owner_Authorization, the deployment Receipt and the Authoritative_State evidence required by Requirement 16.
9. THE Status_Report SHALL name each component under the naming rule of Requirement 13, naming 3tched-fs as 3tched-fs and citing its pinned source directory `crates/threetched-fs` and package name `tched-fs` only as source locations.

### Requirement 18: Provenance and commits

**User Story:** As a judge, I want the LXD standalone work traceable and
separable, so that I can tell pre-existing components from hackathon work.

#### Acceptance Criteria

1. THE Provenance_Record SHALL list the LXD_Plugin, 3tched-fs (pinned source path `crates/threetched-fs`, recorded as a naming defect under Requirement 13 criterion 7), the session derivation in `crates/op-identity/src/session.rs` and every other pre-existing component used by this spec with its path, pinned commit or recorded working-tree digest, and git status, matching the values recorded in the Baseline_Record.
2. WHILE Open question 4 has the status "awaiting owner decision", THE Provenance_Record SHALL mark the LXD_Plugin as "provenance awaiting owner decision" and cite the Blocker_Record created under Requirement 2 criterion 9.
3. THE Provenance_Record SHALL list each new component of this spec (Standalone_Reservation, Standalone_Reservation validator, Instance_Spec, Instance_Spec validator, Provisioning_Procedure_LXD, Cockpit_Glue_LXD) with its path and the `tasks.md` task identifiers that produced it.
4. THE Implementer SHALL make each commit in the Hackathon_Repository focused on one spec task or one record and SHALL name that task identifier or record in the commit message.
5. THE Implementer SHALL create each commit with author and committer dates equal to its actual creation time, on or after 2026-10-30, without overriding either date.
6. THE Implementer SHALL include in hackathon commits no commit history dated before 2026-10-30 and no file copied from a pre-existing component.

# Requirements Document

## Introduction

This spec covers one general, identity-neutral chat interface for any sealed
op-dbus identity (any Branch: the main 3tched identity, 3tchedW3, subsidiary
identities and future ones), built in the hackathon repository
(`/srv/git/kiroween`) for Kiroween 2026. The interface binds to whichever
sealed identity it runs as. Identity, grants and capabilities, tools and audit
all come from that identity's own mounted 3tchedFS namespace. Nothing in the
interface is hard-coded to one Branch; per-Branch values are supplied as
Identity_Profile data or discovered at runtime.

The interface uses the Vercel Chat SDK and the Vercel AI SDK, and it
integrates with three pre-existing op-dbus subsystems:

- grants and capabilities (each sealed method's `required_capability`, enforced
  by the bridge per call);
- the execution tracker (`crates/op-execution-tracker/src/record.rs`:
  `ExecutionRecord.prev_hash`, `hash_execution`, `verify_integrity`);
- the `identity_sled` plugin
  (`crates/op-plugins/src/state_plugins/identity_sled.rs`: `get_own_identity`,
  `get_identity`, `get_session_history`, `record_session_event`,
  `touch_session`, `refresh_credential` and related methods).

Rename note (2026-11-08): this spec was previously named `w3-chat-interface`
and scoped to the 3tchedW3 cockpit. Following the owner decision of
2026-11-08 ("The chat interface should not be W3-specific; it should be
general for all branches"), it was renamed to `identity-chat-interface` and
generalized. Its `.config.kiro` is unchanged.

This spec is separate from `.kiro/specs/cockpit-container/requirements.md`
(the "Cockpit_Spec"). The Cockpit_Spec covers the 3tchedW3 Cockpit container,
the Web3_Mirror and attestation, and the operation-file Chatbot_Glue. The
3tchedW3_Identity running in its Cockpit is one consumer of this Chat_Interface,
not its scope. This spec reuses the Cockpit_Spec glossary terms listed below
and references its requirements by number instead of restating them. For a
Chat_Interface deployment under the 3tchedW3_Identity, the Cockpit_Spec wins
over this spec on cockpit, storage, chain and glue matters.
`.kiro/steering/security-boundaries.md` applies to every requirement here and
wins over both specs. In particular, the steering rule that reserves the main
3tched names and session for the 3tched_Identity still applies: because a
Chat_Session binds only to the identity returned by `get_own_identity` of the
mount it runs under (Requirement 4), a deployment under the 3tchedW3_Identity
can never adopt the main 3tched names or session.

op-dbus (`/srv/git/odbus-verified`), 3tchedFS, `identity_sled`, the execution
tracker, the grant materializer (`op-grants-materializer`, live grant file
`/dev/shm/opdbus/capability-grants.json`, root-only) and the existing
production UI (`/srv/git/3tched.com`) pre-date the hackathon. They are pinned
dependencies: this work reads them, uses them only through their existing
interfaces, and never modifies or copies them.

### Context at spec time (2026-11-08, not re-verified for this spec)

These items come from the owner's brief and the Cockpit_Spec discovery
findings. The Implementer must re-verify each one before relying on it
(Requirement 1).

- The Cockpit_Spec records no 3tchedFS mount for the current user, no
  `lungs.sock` under `/run/opdbus/lungs`, and no 3tchedW3_Identity. The set of
  Branches with a mounted namespace has not been discovered for this spec.
  Every requirement that needs a mounted Bound_Identity namespace is expected
  to start blocked until discovery finds one.
- The Cockpit_Spec records no in-container egress path. Model_Provider calls
  therefore have no confirmed outbound path at spec time for any
  Identity_Container Deployment_Target.
- The existing production UI (`/srv/git/3tched.com`) uses SvelteKit, Svelte 5,
  Vite and `@json-render/svelte`, and talks only to the existing `:8090` TLS
  door through one generic `PluginService/CallMethod` over gRPC-Web with
  exactly one OIA1 or SID1 credential.
- Owner UI stack rule (2026-10-11): application interfaces use only
  Svelte/SvelteKit, Vite and json-render's Svelte renderer; every visible
  element is declared in the active catalog and implemented in its registry;
  no React, JSX or Next.js.
- The AI SDK publishes `@ai-sdk/svelte` (a Svelte 5 `Chat` class) and tool
  calling. The Chat SDK (`chat` package, chat-sdk.dev) is reported to ship a
  web adapter for Svelte that speaks the AI SDK UI message stream protocol
  (Vercel changelog, "Build Chat SDK web UIs in Vue or Svelte"). Exact package
  names, versions and Svelte support are unconfirmed and must be pinned in
  `design.md` (Requirement 3).
- Owner correction: the external surface is `threetched`. `tched_router` and
  `tched-router` are a naming defect in the pinned baseline (Cockpit_Spec
  Requirement 25).
- Owner decision (2026-11-08): one Chat_Interface for all Branches, bound to
  whichever sealed identity it runs as.

## Glossary

### Terms reused from the Cockpit_Spec

The following terms have the meaning defined in the Cockpit_Spec glossary:
**3tched_Identity**, **3tchedW3_Identity**, **Sealed_Identity**, **SID1**,
**Receipt**, **Audit_Chain**, **Authoritative_State**, **Operation_File**,
**3tchedFS_Views**, **Threetched_Surface**, **Lungs_Socket**, **Cockpit**,
**Chatbot_Glue**, **Denial**, **Blocker_Record**, **Owner_Authorization**,
**Live_Change**, **Status_Report**, **Provenance_Record**,
**Baseline_Record**, **Runtime_Record**, **Hackathon_Repository**,
**Implementer**, **Submission_Window**, **W3_Key**.

In this spec, **Cockpit** and **Chatbot_Glue** apply only to deployments under
the 3tchedW3_Identity. **Operation_File** and **3tchedFS_Views** refer to the
mounted namespace of the Bound_Identity.

### Terms defined in this spec

- **Cockpit_Spec**: `.kiro/specs/cockpit-container/requirements.md`.
- **Branch**: A sealed op-dbus identity or subsidiary identity that can run
  the Chat_Interface, for example the 3tched_Identity, the 3tchedW3_Identity
  and subsidiary identities.
- **Bound_Identity**: The sealed identity whose mounted 3tchedFS namespace
  the Chat_Interface runs under, as the kernel-bound caller of that mount and
  as returned by `identity_sled.get_own_identity` through that mount.
- **Bound_Identity_Record**: The public Sealed_Identity fields returned by
  `identity_sled.get_own_identity` for the Chat_Session.
- **Identity_Profile**: Per-Branch, non-secret configuration data (for example
  display name, mount paths and allowed Deployment_Targets), supplied as data
  in the format and schema recorded in `design.md`, never as code.
- **Session_Mode**: The mode of a Chat_Session: standard, control_plane or
  ui_build. The Chat_Route takes it only from the Identity_Profile loaded at
  Chat_Session start, never from the Chat_UI, the model or a tool result. A
  Session_Mode sets limits only; it grants no capability and bypasses no
  validation or confirmation.
- **View_Kind**: The kind of mounted 3tchedFS view that exposes an
  operation, decided by what runs it (steering
  `naming-3tched-threetched.md`): `3tched` for operations that run on our
  code, exposed in `/run/mounts/3tchedFS`, and `threetched` for operations that
  run on the ZeroClaw-derived binary, exposed in `/run/mounts/threetched`. A
  Bound_Identity's Chat_Session uses both views at the same time; each
  Tool_Registry entry carries the View_Kind of the view that exposes it.
- **Legacy_Chat_Inventory**: The record of existing chat code found in op-dbus,
  the existing production UI or elsewhere, kept with the Baseline_Record, with
  each item classified as chat code (to remove) or an identity, grant or
  storage binding (to keep).
- **Deployment_Target**: A place where the Chat_Interface runs for a Branch:
  an Identity_Container or the Host_Dashboard.
- **Identity_Container**: The identity-scoped Incus container of a Branch.
  The Cockpit is the Identity_Container of the 3tchedW3_Identity.
- **Host_Dashboard**: A Deployment_Target on the host whose Chat_UI reaches
  the backend through Door_8090 or the Op_Web_Connector.
- **Chat_Interface**: The hackathon chat application specified here, made of
  the Chat_UI, the Chat_Route, the Tool_Registry, the Schema_Validator, the
  Confirmation_Gate, the Tool_Executor, the Model_Context_Builder, the
  Chain_Verifier, the Secret_Guard and the Profile_Loader.
- **Chat_UI**: The browser part of the Chat_Interface, built with SvelteKit,
  Svelte 5, Vite and the json-render Svelte renderer.
- **Chat_Route**: The server-side handler that runs the Chat SDK and AI SDK
  conversation loop (message stream, tool-call dispatch and Model_Provider
  calls).
- **Chat_Session**: One conversation in the Chat_Interface, bound to exactly
  one Bound_Identity session for its whole lifetime.
- **Public_Identity_Fields**: The non-secret fields of the
  Bound_Identity_Record that `design.md` lists as displayable (for example
  principal id, session id, public key, genesis and display name).
- **Credential_Material**: SID1 bytes, OIA1 bytes, Provider_Credentials,
  identity key material (including W3_Key material), and any value that
  `design.md` classifies as secret.
- **Sealed_Method_Schema**: The method entry of a sealed op-dbus
  PluginSchema as exposed through the Bound_Identity's mounted Operation_File
  tree, including argument schema, result schema, `required_capability` and
  side-effect declaration.
- **Required_Capability**: The `required_capability` value declared by a
  Sealed_Method_Schema (for example `identity_sled.read`,
  `identity_sled.write`, `cap.identity.sled.self.read@v1`,
  `identity_sled.credential.refresh`).
- **Held_Capability_Set**: The set of capabilities that the Bound_Identity
  holds, as discovered through its own mounted namespace by the source named
  in `design.md`.
- **Mutation_Method**: A method whose Sealed_Method_Schema declares
  `SideEffect::Mutation`, or whose side-effect declaration is absent or
  unrecognized.
- **Read_Method**: A method whose Sealed_Method_Schema declares a recognized
  non-mutation side effect.
- **Tool_Registry**: The runtime set of AI SDK tool definitions for one
  Bound_Identity, one per Sealed_Method_Schema, each marked offered or
  unavailable.
- **Offered_Tool**: A Tool_Registry entry that the Model_Context_Builder may
  include in a Model_Provider request.
- **Unavailable_Tool**: A Tool_Registry entry whose Required_Capability is
  absent from the Held_Capability_Set or cannot be determined.
- **Tool_Call**: One AI SDK tool invocation proposed by the model, with a
  tool name and an argument value, belonging to one Chat_Session.
- **Schema_Validator**: The hackathon component that checks Tool_Call
  arguments against the Sealed_Method_Schema.
- **Confirmation_Gate**: The hackathon component that holds a Mutation_Method
  Tool_Call until a Confirmation_Event arrives.
- **Confirmation_Event**: A human interaction in the Chat_UI that approves one
  specific pending Tool_Call, bound to the Chat_Session, the Bound_Identity
  and the digest of the validated Tool_Call input.
- **Tool_Executor**: The hackathon component that executes a validated,
  authorized Tool_Call as one Operation_File call in the Bound_Identity's
  mounted namespace (through the Chatbot_Glue of Cockpit_Spec Requirement 18
  when the Bound_Identity is the 3tchedW3_Identity).
- **Unknown_Outcome**: A Tool_Call state in which the Tool_Executor cannot
  determine from a Receipt whether the operation committed (for example a
  timeout or a dropped connection after sending).
- **Execution_Record**: An op-dbus execution tracker `ExecutionRecord`,
  including `prev_hash`, as read through a granted operation.
- **Chain_Verifier**: The hackathon component that checks Execution_Record
  continuity for a Chat_Session and reports verified, broken or unverified.
- **Model_Provider**: The language-model service that the Chat_Route calls.
- **Provider_Credential**: The credential that authenticates the Chat_Route
  to the Model_Provider.
- **Model_Context**: The full content of one Model_Provider request: system
  prompt, messages, tool definitions and tool results.
- **Model_Context_Builder**: The hackathon component that assembles the
  Model_Context.
- **Secret_Guard**: The hackathon component that detects Credential_Material
  in outbound Model_Context, log lines, persisted client state and rendered
  output.
- **Profile_Loader**: The hackathon component that parses and formats
  Identity_Profile data.
- **Synthetic_Fixture**: A test fixture marked synthetic in the way recorded
  in `design.md`, containing no value observed for a real Branch.
- **Catalog**: The json-render catalog that declares every element type the
  Chat_UI may render.
- **Component_Registry**: The json-render Svelte registry that implements each
  Catalog element.
- **Render_Spec**: A json-render element tree to be rendered by the Chat_UI,
  whether authored by the Implementer or produced by the model.
- **Door_8090**: The existing `:8090` TLS door that serves the generic
  `PluginService/CallMethod` gRPC-Web method.
- **Op_Web_Connector**: The existing op-web same-origin connector, as named in
  `design.md`.
- **Egress_Path**: An existing outbound-only network path, named explicitly in
  `design.md` per Deployment_Target, through which Model_Provider traffic
  leaves the system (the Cockpit_Spec term, applied here to model traffic).
- **Pinned_Package_Set**: The exact npm package names and versions of the Chat
  SDK, the AI SDK, the AI SDK Svelte binding, json-render and any Chat SDK
  adapter, recorded in `design.md`.

## Requirements

### Requirement 1: Discovery before reliance

**User Story:** As the owner, I want every pre-existing interface and every
Branch the chat relies on re-verified and recorded, so that the chat is built
against what actually exists.

#### Acceptance Criteria

1. THE Implementer SHALL record in the Baseline_Record, for each pinned interface used by the Chat_Interface (`identity_sled` methods, execution tracker record and integrity functions, the Sealed_Method_Schema format including `required_capability` and side-effect fields, the Operation_File contract, Door_8090 and the Op_Web_Connector), the source path relative to the pinned op-dbus checkout, the symbol name, the full 40-character pinned commit hash, the symbol signature and whether the symbol is committed at that commit or present only in the working tree.
2. THE Implementer SHALL record in the Runtime_Record, using read-only discovery, each Branch that exists, with the read-only source, the exact observation command and a UTC ISO 8601 timestamp to the second for each entry.
3. THE Implementer SHALL record in the Runtime_Record, using read-only discovery, for each discovered Branch and for each candidate Deployment_Target (the Identity_Container of that Branch and the Host_Dashboard), a present or absent result for each of the two mounted views (the `3tched` View_Kind at `/run/mounts/3tchedFS` and the `threetched` View_Kind at `/run/mounts/threetched`), the Lungs_Socket, Door_8090 and the Op_Web_Connector, with the exact observation command, the observed output or error text and a UTC ISO 8601 timestamp to the second; an unobserved item SHALL be recorded as absent, not omitted.
4. WHERE a mounted namespace exists for a Branch and its Sealed_Method_Schemas grant `identity_sled.get_own_identity`, THE Implementer SHALL identify the Bound_Identity of that namespace only from the Receipt of a `get_own_identity` read through that namespace's Operation_File and record the Public_Identity_Fields and Receipt in the Runtime_Record.
5. THE Implementer SHALL record in the Runtime_Record, for each discovered Branch with a mounted namespace, the method name and Required_Capability of each granted operation that exposes Execution_Records to that Branch, as discovered from its mounted Sealed_Method_Schemas, or an explicit "none" entry when no such operation is granted.
6. THE Implementer SHALL perform Branch discovery without logging in, starting, stopping, restarting, logging out, mounting, unmounting or changing any identity, session, container, grant, storage or deployment.
7. IF a required interface's source path or symbol is absent at the pinned commit recorded in the Baseline_Record, or its signature differs from the recorded signature, THEN THE Implementer SHALL create a Blocker_Record for that interface and leave each dependent task in proposed status.
8. IF no mounted namespace exists for a Branch, or its mounted Sealed_Method_Schemas do not grant `identity_sled.get_own_identity`, THEN THE Implementer SHALL create a Blocker_Record naming that Branch and the missing namespace or Required_Capability, record the Bound_Identity of that Branch as unidentified, and leave each task that runs the Chat_Interface under that Branch in proposed status.
9. IF an observation recorded under criteria 2 to 5 contains Credential_Material, THEN THE Implementer SHALL replace each Credential_Material value with a redaction marker naming only the field before the entry is written to the Baseline_Record, the Runtime_Record or the Hackathon_Repository.
10. WHEN the Chat_Route checks whether its Branch has a mounted namespace before or at Chat_Session start, THE Chat_Route SHALL perform the check server-side using read-only observation only, SHALL accept no Branch, mount state or discovery result supplied by the Chat_UI, the model, a tool result or a request parameter, and SHALL perform no login, start, stop, restart, logout, mount, unmount or change of any identity, session, container, grant or storage as part of that check.
11. IF the supported host mount helper `mount-3tchedfs` fails with an error stating that a selected plugin (including `tched_router`, the naming defect of Cockpit_Spec Requirement 25) is absent from the sealed catalog, THEN THE Implementer SHALL create a Blocker_Record with the helper command, error text and timestamp, record in the Baseline_Record that an op-dbus source fix exists and is not deployed, leave each task that needs a host 3tchedFS view in proposed status until a Runtime_Record entry timestamped after that fix's deployment shows the view mounted, and SHALL NOT mount the view through any other path, edit the sealed catalog or the pinned op-dbus checkout, or deploy the fix without Owner_Authorization.

### Requirement 2: Fresh, separable Svelte interface

**User Story:** As the owner, I want a fresh chat interface that follows the UI
stack rule and stays separable from the existing production UI, so that
hackathon work is reviewable on its own.

#### Acceptance Criteria

1. THE Chat_UI SHALL be implemented with SvelteKit, Svelte 5, Vite and the json-render Svelte renderer.
2. THE Chat_Interface source SHALL reside only in the Hackathon_Repository.
3. THE Chat_Interface source SHALL contain no file, module or import copied from or resolved into `/srv/git/3tched.com` or `/srv/git/odbus-verified`.
4. THE Chat_Interface source SHALL contain no React, JSX, TSX or Next.js dependency, file or import.
5. THE Chat_UI SHALL render only Render_Specs whose every element type is declared in the Catalog and implemented in the Component_Registry.
6. IF a Render_Spec contains an element type absent from the Catalog or the Component_Registry, THEN THE Chat_UI SHALL refuse the whole Render_Spec and display a Catalog error naming the element type.
7. THE Implementer SHALL provide a repository check that reports every Chat_UI visible element lacking a Catalog declaration or a Component_Registry implementation.

### Requirement 3: Chat SDK and AI SDK pinning

**User Story:** As the owner, I want the Chat SDK and AI SDK versions and their
Svelte support confirmed, so that the stack is not assumed.

#### Acceptance Criteria

1. THE Implementer SHALL record the Pinned_Package_Set in `design.md` as one entry per npm package, covering at least the Chat SDK, the AI SDK, the AI SDK Svelte binding, json-render, the Model_Provider package named under Requirement 12.1 and each Chat SDK adapter the Chat_Route uses, with each entry stating the exact package name, the exact version, the documentation source consulted (official documentation page or npm registry page) and the UTC date that source was read.
2. THE Implementer SHALL record in `design.md`, for each Pinned_Package_Set entry, whether the entry runs in the Chat_Route, the Chat_UI or both; the server or browser runtime and minimum runtime version the entry requires; the confirmed Svelte 5 support, or "not applicable" for an entry that runs only in the Chat_Route; and the AI SDK UI message stream protocol version the entry emits or consumes, or "not applicable" for an entry that does neither.
3. THE Chat_Interface package manifest SHALL declare each Pinned_Package_Set entry as an exact version with no range, tag or wildcard specifier, equal to the version recorded in `design.md`, and the committed lockfile SHALL resolve each Pinned_Package_Set entry to that same version.
4. IF a Pinned_Package_Set entry declares React, JSX, Next.js or a runtime as a dependency or peer dependency, directly or through the committed lockfile, and that dependency violates Requirement 2 or Requirement 13 or cannot run at the Chat_Route location recorded under Requirement 13.1, THEN THE Implementer SHALL create a Blocker_Record naming the package, its version and the violated requirement and leave dependent tasks in proposed status.
5. THE Chat_Interface source SHALL import, construct or configure no MCP client, MCP transport or MCP tool source from the AI SDK, the Chat SDK or any other Pinned_Package_Set entry.
6. WHILE any Pinned_Package_Set entry in `design.md` lacks a field required by criterion 1 or criterion 2, THE Implementer SHALL leave every task that installs or imports a Pinned_Package_Set entry in proposed status.
7. THE Chat_UI client bundle SHALL contain no Pinned_Package_Set entry that `design.md` records as running only in the Chat_Route.
8. IF the AI SDK UI message stream protocol version recorded for the Pinned_Package_Set entries that run in the Chat_Route differs from the version recorded for the AI SDK Svelte binding, THEN THE Implementer SHALL create a Blocker_Record naming both entries and both versions and leave every Chat_Route and Chat_UI message-streaming task in proposed status.
9. THE Implementer SHALL provide a repository check that reports every Pinned_Package_Set entry whose version differs between `design.md`, the package manifest and the committed lockfile, and every manifest specifier for a Pinned_Package_Set entry that is not an exact version.

### Requirement 4: Identity binding

**User Story:** As the operator of any Branch, I want each chat session bound to
the identity of the mount the chat runs under, through existing identity_sled
reads, so that the chat acts only as that identity.

#### Acceptance Criteria

1. WHEN a Chat_Session starts, THE Chat_Route SHALL obtain the Bound_Identity_Record by calling `identity_sled.get_own_identity` through the Tool_Executor as one Operation_File call in the mounted namespace that the Chat_Interface runs under, and SHALL send no Model_Provider request and offer no Offered_Tool for that Chat_Session until that call returns a Receipt.
2. THE Chat_Route SHALL take the Bound_Identity only from the `identity_sled.get_own_identity` Receipt of the mount it runs under, and SHALL ignore for identity selection every identity, session, principal or credential value supplied by the Chat_UI, the model, a tool result, the Identity_Profile or a request parameter.
3. WHILE a Chat_Session is active, THE Tool_Executor SHALL execute every Tool_Call of that Chat_Session as an Operation_File call in the mounted namespace of the Bound_Identity recorded at Chat_Session start, and THE Chat_Route SHALL keep that Bound_Identity unchanged.
4. IF a session id, principal id or display name claimed by the Chat_UI client or stated in the Identity_Profile is not exactly equal to the corresponding value in the Bound_Identity_Record, THEN THE Chat_Route SHALL refuse to start the Chat_Session, send no Model_Provider request, offer no Offered_Tool, return an error to the Chat_UI indicating an identity mismatch, and create a Blocker_Record naming the mismatched field with Credential_Material excluded.
5. IF an `identity_sled.get_own_identity` result obtained after start in an active Chat_Session differs in any field from the Bound_Identity_Record obtained at start, or returns a Denial or no Receipt, THEN THE Chat_Route SHALL end the Chat_Session and send no further Model_Provider request or Tool_Call for it, the Confirmation_Gate SHALL discard every pending Tool_Call of that Chat_Session without executing it, and THE Chat_Route SHALL create a Blocker_Record naming the differing fields with Credential_Material excluded.
6. WHERE the Held_Capability_Set contains the Required_Capability of `identity_sled.get_session_history`, WHEN a Chat_Session starts, THE Chat_Route SHALL obtain the session history of the Bound_Identity by calling `identity_sled.get_session_history` through the Tool_Executor, after the `identity_sled.get_own_identity` Receipt of criterion 1 is obtained.
7. IF `identity_sled.get_own_identity` returns a Denial, or returns no Receipt within the read timeout recorded in `design.md` (at most 30 seconds), THEN THE Chat_Route SHALL return the Denial or timeout error to the Chat_UI for display, create a Blocker_Record that records the operation, the caller, the missing capability or policy and the error with Credential_Material excluded, offer no Offered_Tool and execute no Tool_Call for that Chat_Session, and make no retry through another identity, transport or mount.
8. THE Chat_Route SHALL send to the Chat_UI only the Public_Identity_Fields of the Bound_Identity_Record, and THE Chat_UI SHALL display only those fields.
9. THE Chat_Interface SHALL perform every `identity_sled` session write (`record_session_event`, `touch_session`, `refresh_credential`), whether model-proposed or system-initiated, only through the Tool_Executor, targeting only the Bound_Identity's session, under the same Required_Capability check, Schema_Validator check and Confirmation_Gate rules as any other Tool_Call.
10. THE Chat_Interface SHALL contain no code path that changes an identity, session, grant or credential of any identity other than the Bound_Identity.
11. THE Implementer SHALL list in `design.md` each system-initiated `identity_sled` session write and its Required_Capability.
12. WHEN the Implementer deploys or runs the Chat_Interface under a Branch, including the 3tched_Identity, THE Implementer SHALL treat the deployment or run as a Live_Change and SHALL proceed only with an Owner_Authorization that names that Branch.
13. WHEN the Confirmation_Gate releases a Mutation_Method Tool_Call for execution, THE Tool_Executor SHALL call `identity_sled.get_own_identity` in the Bound_Identity's mounted namespace and compare the result with the Bound_Identity_Record obtained at start before making the Mutation_Method Operation_File call, and SHALL make that call only if every field is equal.
14. IF `identity_sled.get_session_history` returns a Denial or no Receipt within the read timeout recorded in `design.md` (at most 30 seconds), THEN THE Chat_Route SHALL continue the Chat_Session without session history, return the Denial or timeout error to the Chat_UI for display, and create a Blocker_Record that records the operation, the caller, the missing capability or policy and the error with Credential_Material excluded.
15. IF a Mutation_Method Tool_Call argument names an identity, session, principal or credential other than that of the Bound_Identity, THEN THE Tool_Executor SHALL refuse the Tool_Call, make no Operation_File call, return an error result to the Chat_Route indicating a cross-identity target, and create a Blocker_Record with Credential_Material excluded.

### Requirement 5: Credential handling

**User Story:** As the owner, I want SID1 and other credential material kept
out of the model, logs, rendered output and browser storage, so that the chat
cannot leak any sealed identity.

#### Acceptance Criteria

1. THE Model_Context_Builder SHALL exclude Credential_Material from every Model_Context, including from operator messages and from tool results returned by the Tool_Executor.
2. THE Chat_Interface SHALL exclude Credential_Material from every log line, error message, telemetry record, rendered element, Chat_Route response or stream chunk sent to the Chat_UI, and persisted server-side Chat_Session record.
3. THE Chat_UI SHALL hold SID1 or OIA1 bytes only in the form, location and lifetime that the existing Door_8090 transport requires, as recorded in `design.md`.
4. THE Chat_UI SHALL persist no Credential_Material to localStorage, sessionStorage, IndexedDB, cookies readable by script, URLs or the service worker cache.
5. THE Secret_Guard SHALL classify an output item as containing Credential_Material when the item contains, in raw form or in any encoding that `design.md` lists for that Credential_Material class, any of: a complete Credential_Material value held by the Chat_Route, a contiguous substring of 16 or more bytes of such a value, or a SID1 or OIA1 envelope, including a value split across two or more consecutive stream chunks.
6. WHEN the Secret_Guard detects Credential_Material in an outbound Model_Context, Chat_Route response or stream chunk to the Chat_UI, Render_Spec, log line, telemetry record, persisted server-side Chat_Session record or persisted client state, THE Secret_Guard SHALL block the whole output item on the server before any byte of it leaves the Chat_Route, independently of any check in the Chat_UI, keep the pending Tool_Calls of the Chat_Session unchanged, replace the item sent to the Chat_UI with an error indicating the blocked output channel, and record a security event that names the output channel, the Credential_Material class, the Chat_Session and the Bound_Identity display name and that contains no part of the detected value and no hash or digest computed over it.
7. IF the Secret_Guard returns an error for an output item or returns no result within the check time limit recorded in `design.md`, THEN THE Chat_Route SHALL withhold that output item, return to the Chat_UI an error indicating that the credential check failed, and keep the pending Tool_Calls of the Chat_Session unchanged.
8. IF a request from the Chat_UI to the Chat_Route contains Credential_Material in a chat message, Tool_Call argument or Confirmation_Event payload, outside the Door_8090 transport authentication that criterion 3 permits, THEN THE Chat_Route SHALL reject the whole request before it reaches the Model_Context_Builder, the Tool_Executor, any log line or any persisted state, return to the Chat_UI an error indicating that credential content was refused, keep the Chat_Session and its pending Tool_Calls unchanged, and have the Secret_Guard record a security event as specified in criterion 6.
9. THE Hackathon_Repository SHALL contain no Credential_Material, and the repository check of Cockpit_Spec Requirement 8.5 SHALL cover the Chat_Interface source.
10. THE Tool_Executor SHALL use the kernel-bound caller identity of the mount the Chat_Interface runs under (as Cockpit_Spec Requirement 18.3 requires for the Cockpit) and SHALL pass no SID1 file and no `--lungs-session` value, whatever a Tool_Call argument, the Chat_UI, the model or the Identity_Profile supplies.

### Requirement 6: Capability-derived tool registry

**User Story:** As the owner, I want the tools offered to the model derived from
the Bound_Identity's sealed schemas and existing grants, so that the model can
only reach methods that identity is already allowed to call.

#### Acceptance Criteria

1. WHEN a Chat_Session starts, THE Tool_Registry SHALL derive on the server side, before the Chat_Route sends the first Model_Provider request of that Chat_Session, exactly one tool definition for each distinct plugin and method pair whose Sealed_Method_Schema is exposed in the Bound_Identity's mounted 3tchedFS_Views, taking the argument schema, result schema, Required_Capability and side-effect declaration unchanged from that Sealed_Method_Schema.
2. WHEN the Tool_Registry derives a tool definition whose Required_Capability is a member of the Held_Capability_Set read through the Bound_Identity's own mounted namespace for that Chat_Session, THE Tool_Registry SHALL mark that tool as an Offered_Tool.
3. IF a tool's Required_Capability is absent from the Held_Capability_Set, is not declared by its Sealed_Method_Schema, or cannot be determined because the Sealed_Method_Schema cannot be read or parsed or because the Held_Capability_Set source returns a Denial, no Receipt or an unparseable result, THEN THE Tool_Registry SHALL mark the tool as an Unavailable_Tool together with a reason stating whether the capability is absent or undetermined.
4. THE Chat_UI SHALL display each Unavailable_Tool, as supplied by the Chat_Route from the server-side Tool_Registry, with its plugin, method, Required_Capability (or a statement that none is declared) and the absent-or-undetermined reason.
5. WHEN the sealed catalog hash or generation that a mounted 3tchedFS_View reports differs from the value recorded at the last Tool_Registry derivation, as checked before each Model_Provider request and before each Operation_File call, THE Tool_Registry SHALL re-derive all tool definitions and re-read the Held_Capability_Set before the Chat_Route sends the next Model_Provider request, and THE Confirmation_Gate SHALL discard every pending unconfirmed Tool_Call of the Chat_Session.
6. THE Implementer SHALL record in `design.md` the source of the Held_Capability_Set within a Bound_Identity's mounted namespace, stated without reference to a specific Branch.
7. IF a Sealed_Method_Schema belongs to a plugin whose name is exactly `tched_router` or `tched-router`, THEN THE Tool_Registry SHALL exclude that method from both the Offered_Tools and the Unavailable_Tools, and THE Implementer SHALL handle the naming defect as specified in Cockpit_Spec Requirement 25.4.
8. FOR ALL Chat_Sessions, the set of Required_Capabilities of Offered_Tools SHALL be a subset of the Bound_Identity's Held_Capability_Set (invariant).
9. IF a request from the Chat_UI client supplies tool definitions, Required_Capability values, capability claims or offered or unavailable markings, THEN THE Chat_Route SHALL discard those values and leave the server-side Tool_Registry unchanged.
10. IF the sealed catalog hash or generation checked immediately before an Operation_File call differs from the value recorded at the last Tool_Registry derivation, THEN THE Tool_Executor SHALL send no Operation_File call and SHALL return to the Chat_Route a tool result stating that the catalog changed, and THE Tool_Registry SHALL re-derive as specified in criterion 5.
11. IF the Held_Capability_Set source returns a Denial, THEN THE Chat_Interface SHALL create a Blocker_Record with the operation, caller, missing capability or policy, error text and timestamp, with Credential_Material excluded.
12. THE Tool_Registry SHALL derive tool definitions from both mounted views of the Bound_Identity at the same time and SHALL record in each Tool_Registry entry the View_Kind of the view that exposes its Sealed_Method_Schema.
13. IF a Sealed_Method_Schema appears in a view whose View_Kind contradicts what runs the operation (a `threetched` plugin in the `3tched` view, or any other plugin in the `threetched` view), THEN THE Tool_Registry SHALL exclude that method from both the Offered_Tools and the Unavailable_Tools, and THE Chat_Interface SHALL create a Blocker_Record naming the plugin, method and view as a naming defect.
14. IF only one of the two views of the Bound_Identity is mounted, THEN THE Tool_Registry SHALL mark every tool of the missing view's View_Kind as an Unavailable_Tool with the reason that the view is absent, and SHALL keep deriving tools from the mounted view.
15. FOR ALL re-derivations under criterion 5 in which the Sealed_Method_Schemas of `3tched` View_Kind operations are unchanged, THE Tool_Registry SHALL produce `3tched` View_Kind entries identical to those before the re-derivation, so that a threetched upgrade changes only `threetched` View_Kind entries (upgrade isolation property).

### Requirement 7: Grant immutability and denial handling

**User Story:** As the owner, I want the chat to reflect and use existing grants
only, so that it can never widen what any Bound_Identity is allowed to do.

#### Acceptance Criteria

1. THE Chat_Interface, including the Chat_Route and every server-side component it runs, SHALL contain no code path that writes, materializes, broadens or overrides capability grants, including `/dev/shm/opdbus/capability-grants.json` and `op-grants-materializer`.
2. WHEN the Tool_Executor's Operation_File call for a Tool_Call returns or produces a Denial, other than an Unknown_Outcome handled by Requirement 8.6, THE Chat_Route SHALL create a Blocker_Record on the server before it sends the Tool_Call result to the Chat_UI, containing the plugin and method, the Bound_Identity principal id as caller, the missing Required_Capability or policy as returned (or a marker stating it was not returned), the Denial error text and a timestamp.
3. WHEN the Chat_Route sends a Denial result to the Chat_UI, THE Chat_UI SHALL display the Denial error text exactly as returned, except for replacements the Secret_Guard makes to Credential_Material, together with the plugin, method and missing Required_Capability or policy.
4. WHEN a Tool_Call receives a Denial under criterion 2, THE Tool_Executor SHALL end that Tool_Call, send no further Operation_File call for it, and make no attempt through another Operation_File, transport, identity, Branch, Door_8090 call, direct database edit, raw Incus command or chain call.
5. WHEN an Offered_Tool receives a Denial under criterion 2, THE Tool_Registry SHALL mark that tool as an Unavailable_Tool for the rest of the Chat_Session, even if the Held_Capability_Set lists its Required_Capability and even after a re-derivation under Requirement 6.5, and THE Confirmation_Gate SHALL discard every pending Tool_Call that names that tool.
6. WHEN a Tool_Call receives a Denial under criterion 2, THE Model_Context_Builder SHALL add that Denial to the Model_Context only as the tool result of that Tool_Call, containing only a denial indication, the plugin and method, the missing Required_Capability or policy, and the error text after Secret_Guard redaction.
7. IF the Chat_Route cannot create the Blocker_Record for a Denial, THEN THE Tool_Executor SHALL still end the Tool_Call as in criterion 4, and THE Chat_UI SHALL display the Denial together with an error saying the Blocker_Record was not created.
8. IF the Chat_Route receives a request from the Chat_UI to run, retry or confirm a Tool_Call or tool that was denied in the current Chat_Session, including a Confirmation_Event, THEN THE Chat_Route SHALL reject the request with an error indicating the earlier Denial and send no Operation_File call.
9. FOR ALL Chat_Sessions, after the first Denial under criterion 2 for a tool, THE Tool_Executor SHALL send zero further Operation_File calls for that tool's plugin and method in that Chat_Session (invariant).

### Requirement 8: Tool-call validation and execution

**User Story:** As the operator of any Branch, I want each model tool call to
map to exactly one validated operation-file call, so that every action is
traceable and schema-conformant.

#### Acceptance Criteria

1. THE Tool_Executor SHALL execute each Tool_Call as exactly one Operation_File call `operations/<plugin>/<method>/call` in the Bound_Identity's mounted namespace, with the plugin and method taken from the Tool_Registry entry of the named Offered_Tool and never from Tool_Call text, and SHALL send no other Operation_File call for that Tool_Call except the read-back of criterion 5 and the repetitions of criterion 6.
2. WHEN the Chat_Route receives a Tool_Call from the Model_Provider response of a Chat_Session, THE Chat_Route SHALL apply the Offered_Tool check of criterion 4 first, then the Schema_Validator check of the argument value against the argument schema of the Sealed_Method_Schema, then the Confirmation_Gate of Requirement 9 for a Mutation_Method, before the Tool_Executor sends any Operation_File call.
3. IF a Tool_Call argument value fails validation, including an argument value that does not parse as a value of the schema's type, THEN THE Schema_Validator SHALL reject the Tool_Call with an error naming each failing argument path and the schema constraint it fails, THE Model_Context_Builder SHALL return that error to the model as the tool result, THE Confirmation_Gate SHALL hold nothing for that Tool_Call, and THE Tool_Executor SHALL send no Operation_File call.
4. IF a Tool_Call names a tool that is an Unavailable_Tool or is absent from the Chat_Session's Tool_Registry, THEN THE Tool_Executor SHALL reject the Tool_Call, THE Model_Context_Builder SHALL return to the model a tool result naming the tool and stating that it is not offered, and THE Tool_Executor SHALL send no Operation_File call.
5. WHEN the Tool_Executor receives a Receipt for a Tool_Call, THE Tool_Executor SHALL read back the Authoritative_State through the granted Read_Method that `design.md` names for that method, and THE Chat_UI SHALL display the Receipt and that Authoritative_State.
6. IF the Tool_Executor receives no Receipt within 30 seconds after sending an Operation_File call, or the connection closes after sending and before a Receipt arrives, THEN THE Tool_Executor SHALL mark the Tool_Call as Unknown_Outcome and reconcile it only by repeating the same Operation_File call with byte-identical input, keeping at most one repetition in flight, making at most 3 repetitions with the same 30-second limit each, and reusing the Confirmation_Event of Requirement 9.4; THE Chat_UI SHALL display the Tool_Call as unknown until a Receipt arrives; and if the third repetition gets no Receipt, THE Tool_Executor SHALL send no further call for that Tool_Call and THE Model_Context_Builder SHALL report the Tool_Call to the model as unknown.
7. WHERE the Bound_Identity is the 3tchedW3_Identity, THE Tool_Executor SHALL perform each Operation_File call through the Chatbot_Glue as specified in Cockpit_Spec Requirement 18.
8. FOR ALL argument values outside the argument schema of a Sealed_Method_Schema, THE Schema_Validator SHALL reject the value (error-condition property).
9. FOR ALL argument values accepted by the Schema_Validator, the Operation_File input sent by the Tool_Executor SHALL decode to a value equal to the accepted argument value (round-trip property).
10. THE Chat_Route SHALL run the Offered_Tool check, the Schema_Validator, the Confirmation_Gate and the Tool_Executor on the server side, and SHALL send an Operation_File call only for a Tool_Call that the Chat_Route received from the Model_Provider response of the same Chat_Session and that passed every server-side check, whatever checks the Chat_UI has already run.
11. IF a request from the Chat_UI supplies a tool name, argument value or Tool_Call, other than a Confirmation_Event or rejection that refers to a pending Tool_Call of the same Chat_Session, THEN THE Chat_Route SHALL reject the request, leave every pending Tool_Call unchanged, and send no Operation_File call.
12. IF `design.md` names no granted Read_Method for the method, or the read-back of criterion 5 returns a Denial or an error, THEN THE Tool_Executor SHALL keep the Receipt, mark the Authoritative_State of the Tool_Call as unverified, and send no repetition of the original Operation_File call, and THE Chat_UI SHALL display the Receipt with the Authoritative_State marked unverified and SHALL not display the operation as completed, as Requirement 11.6 requires.
13. THE Tool_Executor SHALL send each Operation_File call only through the mounted view of the Tool_Registry entry's View_Kind, and SHALL never send it through the other view, including after a Denial, an error or an Unknown_Outcome.
14. FOR ALL Tool_Calls, the view through which the Tool_Executor sends the Operation_File call SHALL equal the view of the called tool's View_Kind (view routing invariant).

### Requirement 9: Mutation confirmation

**User Story:** As the operator of any Branch, I want every state-changing tool
call to wait for my explicit approval, so that the model cannot change state on
its own.

#### Acceptance Criteria

1. WHEN the Schema_Validator accepts a Tool_Call that names an Offered_Tool whose method is a Mutation_Method, THE Confirmation_Gate SHALL hold the Tool_Call as pending in Chat_Route server-side state, together with the validated input and the digest that the Confirmation_Gate computes from that input by the method recorded in `design.md`, before the Tool_Executor sends any Operation_File call, and THE Chat_UI SHALL display, from that server-held pending record, the plugin, method, validated arguments, Required_Capability and Bound_Identity display name with one approve control and one reject control.
2. THE Tool_Executor SHALL execute a Mutation_Method Tool_Call only after the Confirmation_Gate has accepted a Confirmation_Event that names that pending Tool_Call, that the Chat_Route attributes to the same Chat_Session and Bound_Identity as the Tool_Call, and whose input digest equals the digest that the Confirmation_Gate computed and holds for that Tool_Call; any digest, argument value or identity value supplied by the Chat_UI client SHALL serve only for comparison and SHALL never become the input sent in the Operation_File call.
3. THE Confirmation_Gate SHALL accept as a Confirmation_Event only a confirmation request that the Chat_UI sends from the approve control and that the Chat_Route receives separately from the message stream, and SHALL treat model output, Tool_Call arguments, tool results and message text, including text typed by the operator, as non-confirming.
4. THE Confirmation_Gate SHALL atomically consume each Confirmation_Event for at most one Tool_Call and each pending Tool_Call for at most one Confirmation_Event, so that of two or more approvals for the same pending Tool_Call exactly one is accepted; the Unknown_Outcome repetition of Requirement 8.6 SHALL count as the same Tool_Call and SHALL require no new Confirmation_Event.
5. WHEN the Chat_Route receives, from the reject control, a reject request that it attributes to the same Chat_Session and Bound_Identity as a pending Tool_Call, THE Confirmation_Gate SHALL discard the Tool_Call, THE Tool_Executor SHALL send no Operation_File call for it, and THE Model_Context_Builder SHALL report the operator rejection to the model as a tool result.
6. FOR ALL event sequences, THE Tool_Executor SHALL execute no Mutation_Method Tool_Call that lacks an earlier Confirmation_Event accepted by the Confirmation_Gate under criteria 2, 3 and 4 (invariant).
7. IF a confirmation request names no pending Tool_Call of the Chat_Session, names a Tool_Call that is already consumed, rejected, expired or discarded, is attributed to a different Chat_Session or Bound_Identity, or carries a digest that differs from the digest held by the Confirmation_Gate, THEN THE Confirmation_Gate SHALL refuse the request, THE Tool_Executor SHALL send no Operation_File call, THE Chat_UI SHALL display an error naming the failed check, and any still-pending Tool_Call SHALL stay pending with its held input and digest unchanged.
8. IF a pending Tool_Call receives neither an accepted Confirmation_Event nor a reject request within the pending-confirmation timeout recorded in `design.md`, which SHALL not exceed 300 seconds, THEN THE Confirmation_Gate SHALL discard the Tool_Call, THE Tool_Executor SHALL send no Operation_File call for it, and THE Model_Context_Builder SHALL report the expiry to the model as a tool result.
9. IF the Chat_Route restarts or the Chat_Session ends while a Tool_Call is pending, THEN THE Confirmation_Gate SHALL discard that Tool_Call, and THE Tool_Executor SHALL send no Operation_File call for it in response to any confirmation request received afterwards.

### Requirement 10: Execution tracker linkage and chain verification

**User Story:** As a verifier, I want every chat tool call linked to its
execution tracker record and the session chain verifiable in the UI, so that I
can check what the chat did without trusting the chat.

#### Acceptance Criteria

1. WHEN a Tool_Call produces a Receipt, THE Chat_Route SHALL link the Tool_Call, on the server, to the Execution_Record whose identifier equals the execution identifier carried by that Receipt as named in `design.md`, and THE Chat_UI SHALL display that link with the Execution_Record identifier.
2. WHEN the Chain_Verifier completes a verification run, THE Chat_UI SHALL display the Execution_Records of the read segment in the order returned by the granted read operation named in `design.md`, each with its `prev_hash`, its `exec_hash`, its linked Tool_Call if any, and its per-link result.
3. IF the `prev_hash` of any Execution_Record other than the first of the read segment differs byte-for-byte from the `exec_hash` of the record immediately before it in that segment, THEN THE Chain_Verifier SHALL set its continuity result to broken, report broken for the Chat_Session, and name the first record whose link differs, where the read segment is the contiguous Execution_Record sequence returned by the granted read operation from the earliest to the latest Execution_Record linked to the Chat_Session, and the first record of the segment is an anchor whose `prev_hash` is displayed but not checked.
4. WHERE the existing `verify_integrity` result is exposed through a granted operation of the Bound_Identity, THE Chain_Verifier SHALL display each read Execution_Record's `verify_integrity` result alongside its own per-link continuity result, and SHALL report broken for the Chat_Session, naming the record, for any record whose `verify_integrity` result is false.
5. WHERE `design.md` records an Owner_Authorization for recomputing `hash_execution` in the Chat_Interface, THE Chain_Verifier SHALL implement the recomputation from the cited pinned source without copying it, SHALL report broken naming any record whose recomputed value differs from its `exec_hash`, and SHALL report unverified naming any record for which the recomputation verdict disagrees with the `verify_integrity` output on the same record.
6. IF no granted operation exposes Execution_Records to the Bound_Identity, or the granted read operation returns a Denial, THEN THE Chain_Verifier SHALL report unverified with that reason and issue no read through another transport, another identity or direct store access, and THE Implementer SHALL create a Blocker_Record naming the Branch, the operation, the caller, the missing capability or policy, and the error.
7. THE Chat_Interface SHALL treat Receipts and Execution_Records as the audit source of truth, SHALL label every displayed chat-side history entry as a non-authoritative display cache, SHALL never pass display cache entries to the Chain_Verifier, and SHALL display the Receipt or Execution_Record value wherever it differs from a display cache entry.
8. FOR ALL read segments in which every record's `prev_hash` and `exec_hash` were read, THE Chain_Verifier SHALL set its continuity result to broken if and only if at least one record other than the anchor has a `prev_hash` that differs byte-for-byte from its predecessor's `exec_hash` (equivalence property).
9. THE Chain_Verifier SHALL run in the Chat_Route server process and SHALL take as input only Execution_Records that the Tool_Executor read through Operation_File calls in the Chat_Session's Bound_Identity namespace, ignoring any Execution_Record, hash or verification result supplied by the Chat_UI, the model, a Tool_Call argument or the display cache.
10. WHEN a Receipt of the Chat_Session is linked, or the operator requests re-verification through the Chat_UI, THE Chain_Verifier SHALL re-read the read segment, display the time of that read, and report verified only if every Receipt-producing Tool_Call of the Chat_Session is linked to a record in the segment, the continuity result is not broken, and no `verify_integrity` or recomputation result marks a record broken or discrepant, with broken taking precedence over unverified and unverified over verified.
11. IF a Receipt carries no execution identifier, the identified Execution_Record is absent from the read segment, or the granted read operation returns an error other than a Denial or reaches Unknown_Outcome, THEN THE Chat_Route SHALL mark the affected Tool_Call unlinked, THE Chain_Verifier SHALL report unverified naming the reason, and THE Chat_Interface SHALL keep the Receipt and all previously read Execution_Records unchanged.

### Requirement 11: Committed state as display authority

**User Story:** As the operator of any Branch, I want displayed operation state
to come from committed op-dbus state, so that streamed model text is never
mistaken for a completed action.

#### Acceptance Criteria

1. WHEN the Tool_Executor holds both the Receipt for a Tool_Call's Operation_File call and the Authoritative_State read back through the granted read that `design.md` names for that method (Requirement 8.5), THE Chat_Route SHALL set the Tool_Call status to completed and stream that status, the Receipt and the Authoritative_State to the Chat_UI in one status update.
2. WHILE a Tool_Call lacks a Receipt and holds no terminal status, THE Chat_Route SHALL set the Tool_Call status to awaiting confirmation while the Confirmation_Gate holds the Tool_Call, to pending from the start of the Operation_File call, and to unknown from the Unknown_Outcome until a Receipt arrives through the reconciliation of Requirement 8.6.
3. THE Chat_UI SHALL display model-generated text in a Catalog element labelled as model output, distinct from the Catalog element that displays Tool_Call status, Receipts and Authoritative_State, and SHALL display for each Tool_Call only the most recent status streamed by the Chat_Route, deriving no status in the browser.
4. IF model-generated text claims an operation result that differs from the Receipt or Authoritative_State, THEN THE Chat_Route SHALL leave the Tool_Call status unchanged and THE Chat_UI SHALL display the Chat_Route-streamed status, Receipt and Authoritative_State as the operation result.
5. THE Chat_Route SHALL assign each Tool_Call exactly one status at a time from awaiting confirmation, pending, unknown, unconfirmed, completed, rejected, denied and failed, setting rejected when the Confirmation_Gate discards the Tool_Call (Requirement 9.5), denied when the Tool_Executor's Operation_File call returns a Denial (Requirement 7.2) and failed when the Operation_File call returns an error result that is not a Denial, with completed, rejected, denied and failed treated as terminal.
6. IF the Tool_Executor holds a Receipt but the Authoritative_State read-back fails, returns a Denial, or `design.md` names no granted read for that method, THEN THE Chat_Route SHALL set the Tool_Call status to unconfirmed, stream the Receipt together with the read-back error or the missing-read indication, and SHALL not set completed for that Tool_Call on the Receipt alone.
7. FOR ALL Chat_Session event sequences with identical Confirmation_Events, Operation_File results, Receipts and Authoritative_State read-backs, THE Chat_Route SHALL produce identical Tool_Call status sequences regardless of the content of model-generated text (invariant).

### Requirement 12: Model and provider decisions

**User Story:** As the owner, I want the model provider choice and its credential
handling recorded explicitly, so that model access is a deliberate decision.

#### Acceptance Criteria

1. THE Implementer SHALL record in `design.md` the Model_Provider, the exact model identifier and version, the AI SDK provider package name and version as an entry of the Pinned_Package_Set, the Model_Provider data-retention terms (whether request content is retained, for how long, and whether it is used for training, with the source document and the date it was consulted), and the reason for each choice.
2. THE Implementer SHALL record in `design.md`, for each Deployment_Target, the location where the Provider_Credential is held and the component that reads it, stated without the credential value, with that location outside the Hackathon_Repository, the Chat_UI, the browser, log output and every Identity_Profile.
3. THE Model_Context_Builder SHALL build each Model_Context only from a system prompt authored by the Implementer in the Hackathon_Repository, the Offered_Tool definitions of the Chat_Session's current Tool_Registry (with every Unavailable_Tool excluded), the Public_Identity_Fields of the Chat_Session's Bound_Identity, and the operator messages and tool results of that same Chat_Session, with Credential_Material excluded.
4. WHILE any of the Model_Provider, the model identifier and version, the provider package entry, the data-retention terms or a Deployment_Target's Provider_Credential location is absent from `design.md`, THE Implementer SHALL leave in proposed status every task that implements, configures or runs a Chat_Route Model_Provider call for the affected Deployment_Target.
5. FOR ALL Model_Contexts, the Model_Context SHALL contain no Credential_Material, including no SID1 bytes, no OIA1 bytes, no W3_Key material and no Provider_Credential (invariant).
6. WHEN the Chat_Route sends a Model_Provider request, THE Chat_Route SHALL send it through the AI SDK provider package recorded in the Pinned_Package_Set, using the model identifier and version recorded in `design.md`, over the Egress_Path recorded for that Deployment_Target, only after the Secret_Guard has checked that Model_Context, and SHALL use no other Model_Provider or model as a fallback.
7. IF the Provider_Credential is absent or unreadable at its recorded location, or the model identifier or provider package configured for the Chat_Route differs from the one recorded in `design.md`, THEN THE Chat_Route SHALL send no Model_Provider request, SHALL return to the Chat_UI a configuration error naming the missing or mismatched item with Credential_Material excluded, and SHALL leave the Chat_Session messages and pending Tool_Calls unchanged.
8. THE Chat_Route SHALL read the Provider_Credential only on the server side and SHALL include it in no response, message stream, tool result, Render_Spec or error sent to the Chat_UI.

### Requirement 13: Transport and route placement

**User Story:** As the owner, I want the chat reachable only through existing
doors on every deployment target, so that the interface adds no network
surface for any Branch.

#### Acceptance Criteria

1. THE Implementer SHALL record in `design.md`, for each Deployment_Target, the Chat_Route location (the Deployment_Target, the process that hosts the Chat_Route and the identity it runs under), the path from the Chat_UI to the Chat_Route, the path from the Chat_Route to the Tool_Executor, and the Egress_Path for Model_Provider calls, with each path entry naming every hop and the pre-existing component and owner that provides that hop.
2. THE Chat_Interface SHALL add no new listening port or inbound network door on any Deployment_Target, such that the set of listening sockets recorded in the Runtime_Record for a Deployment_Target while the Chat_Interface runs is identical to the set recorded while the Chat_Interface is not running.
3. WHERE the Deployment_Target is an Identity_Container, THE Chat_Interface SHALL reach the host from that Identity_Container only through the Lungs_Socket, as Cockpit_Spec Requirement 19.3 specifies for the Cockpit, and SHALL open no connection to Door_8090, the Op_Web_Connector or any other host address or host socket.
4. WHERE the Deployment_Target is the Host_Dashboard, THE Chat_UI SHALL send every request to the Chat_Route through Door_8090 or the Op_Web_Connector and SHALL send no request to any other backend origin.
5. IF no Chat_Route location for a Deployment_Target satisfies criteria 2, 3, 4 and 10 using only paths recorded in `design.md` as pre-existing, THEN THE Implementer SHALL create a Blocker_Record naming the Deployment_Target, each unsatisfied criterion and the paths examined, and SHALL leave the Chat_Route tasks for that Deployment_Target in proposed status until `design.md` records a location that satisfies those criteria.
6. IF no existing Egress_Path from a Deployment_Target reaches the Model_Provider, THEN THE Implementer SHALL create a Blocker_Record naming the Deployment_Target and the Model_Provider, SHALL leave the Model_Provider integration tasks for that Deployment_Target in proposed status, and THE Chat_Route SHALL send no Model_Provider request from that Deployment_Target.
7. THE Chat_Interface SHALL attach no Incus proxy device, `egress-socket` profile, HTTP proxy setting or host socket other than the Lungs_Socket directory to any Identity_Container, as Cockpit_Spec Requirement 11.4 specifies for the Cockpit.
8. THE Chat_Route SHALL send Model_Provider traffic only through the Egress_Path that `design.md` names for its Deployment_Target, SHALL initiate outbound connections only, and SHALL accept no inbound connection from the Model_Provider.
9. THE Chat_UI SHALL send no request directly to the Model_Provider, so that every Model_Provider call is made by the Chat_Route.
10. WHEN the Chat_Route dispatches a Tool_Call, THE Chat_Route SHALL hand it to a Tool_Executor running on the same Deployment_Target under the same Bound_Identity, and THE Tool_Executor SHALL execute it only as an Operation_File call in that Bound_Identity's mounted namespace, without Door_8090, a direct gRPC, D-Bus or Incus call, or any other transport.

### Requirement 14: Untrusted content handling

**User Story:** As the owner, I want tool results and fetched content treated as
data, so that injected text cannot steer the chat into unapproved actions.

#### Acceptance Criteria

1. THE Model_Context_Builder SHALL place each tool result, in every Model_Context of the Chat_Session including resent conversation history, only as a tool-result message linked to the Tool_Call that produced it, and SHALL copy no tool-result content into the system prompt, an operator message or a tool definition.
2. THE Chat_UI SHALL render tool results and model text through Catalog elements that display the content as literal text, so that embedded HTML, script, links and json-render element trees appear as characters and are neither interpreted, rendered as a Render_Spec, navigated nor executed.
3. THE Chat_Route SHALL apply the capability, validation and confirmation rules of Requirements 6, 8 and 9 to every Tool_Call, with no exemption, reduced check, changed Mutation_Method classification or confirmation derived from the content of any tool result, model text or earlier Tool_Call, as Requirement 9.3 requires for confirmation.
4. THE Chat_Route and THE Tool_Executor SHALL derive no identity, session, principal, Branch, mount path, Deployment_Target or credential selection from tool-result content, and SHALL keep the Bound_Identity of the Chat_Session unchanged regardless of any identity, session or Branch named in a tool result, as required by Requirements 4.2 and 4.3.
5. THE Chat_Route SHALL dispatch a Tool_Call only from a structured AI SDK tool-call part of a Model_Provider response, and SHALL treat tool names, arguments and tool-call-shaped data that appear in tool results or model text as text that dispatches no Tool_Call.
6. THE Model_Context_Builder SHALL compose the system prompt of every Model_Context only from Implementer-authored text recorded in `design.md` and Public_Identity_Fields of the Bound_Identity_Record, identical for every Model_Context of the Chat_Session.
7. WHEN the number of Tool_Calls dispatched in response to one operator message reaches the tool-call limit of the Chat_Session's Session_Mode, THE Chat_Route SHALL dispatch no further Tool_Call and request no further Model_Provider response for that operator message, and THE Chat_UI SHALL display that the limit was reached. The tool-call limit SHALL be 5000 for the control_plane and ui_build Session_Modes (owner decision, 2026-11-08) and, for the standard Session_Mode, the value recorded in `design.md`, between 1 and 10 inclusive.
8. IF the Identity_Profile names no Session_Mode or a value other than standard, control_plane or ui_build, THEN THE Chat_Route SHALL apply the standard Session_Mode, and THE Chat_Route SHALL ignore any Session_Mode or tool-call limit supplied by the Chat_UI, the model or a tool result.
9. WHILE a Chat_Session runs in the control_plane or ui_build Session_Mode, THE Chat_Route SHALL apply the capability, validation and confirmation rules of Requirements 6, 8 and 9 to every Tool_Call unchanged, so that the raised limit changes only how many Tool_Calls one operator message may dispatch.

### Requirement 15: Error states

**User Story:** As the operator of any Branch, I want each failure shown
clearly, so that I know what failed and what to do next.

#### Acceptance Criteria

1. IF the Bound_Identity's mounted 3tchedFS namespace for the Deployment_Target is absent or unreadable when a Chat_Session starts or before an Operation_File call is sent, THEN THE Chat_Route SHALL return a typed error of kind missing-mount naming the expected mount path from the Identity_Profile, SHALL mark every Tool_Registry entry as an Unavailable_Tool, and SHALL send no Operation_File call through any other mounted namespace, identity or Branch.
2. IF the path from the Chat_Route to the Tool_Executor, or the Egress_Path, recorded in `design.md` under Requirement 13.1 refuses a connection or gives no response within 10 seconds before an Operation_File call or Model_Provider request has been sent, THEN THE Chat_Route SHALL return a typed error of kind transport naming that path, and SHALL make no attempt through another path, transport, identity, Branch, Door_8090 call, direct database edit, raw Incus command or chain call.
3. IF the Model_Provider returns an error or sends no response within 60 seconds of a request, THEN THE Chat_Route SHALL return a typed error of kind provider carrying the provider error text, SHALL dispatch no Tool_Call from the failed or partial response, and SHALL keep every pending, awaiting-confirmation and unknown Tool_Call of the Chat_Session in its existing state.
4. IF a Sealed_Method_Schema read through the Bound_Identity's Operation_File tree cannot be parsed or lacks an argument schema, THEN THE Tool_Registry SHALL mark that method as an Unavailable_Tool, THE Chat_Route SHALL return a typed error of kind schema naming the plugin and method, and THE Tool_Registry SHALL leave every other entry's offered or unavailable status unchanged.
5. IF the Identity_Profile cannot be parsed, is rejected under Requirement 19.5 or 19.11, or causes a refusal under Requirement 19.8, THEN THE Chat_Route SHALL return a typed error of kind configuration naming the failing field, SHALL offer no Offered_Tool, and SHALL send no Model_Provider request for that Chat_Session.
6. THE Chat_Route SHALL return each error state of this requirement, each Denial of Requirement 7.2 and each validation rejection of Requirement 8.3 as a typed error containing exactly one error kind (missing-mount, transport, provider, schema, configuration, unknown-outcome, denial or validation), the name of the failing item, and the operator next step recorded in `design.md` for that error kind, and THE Chat_UI SHALL render each typed error through a Catalog element that shows those three values.
7. IF the Chat_UI cannot open a connection to the Chat_Route within 10 seconds over the Chat_UI-to-Chat_Route path recorded in `design.md` under Requirement 13.1, THEN THE Chat_UI SHALL display an error of kind transport naming that path through a Catalog element and SHALL send no request through any other path.
8. IF the path from the Chat_Route to the Tool_Executor fails after an Operation_File call has been sent and before its Receipt arrives, THEN THE Chat_Route SHALL return a typed error of kind unknown-outcome for that Tool_Call, and THE Tool_Executor SHALL reconcile it only as Requirement 8.6 specifies, with Requirement 9.4 applying to any Mutation_Method Tool_Call.
9. WHEN the Chat_Route builds a typed error, THE Secret_Guard SHALL replace each detected Credential_Material value in every field of the typed error with a redaction marker before the Chat_Route returns it to the Chat_UI.

### Requirement 16: Accessibility

**User Story:** As an operator using a keyboard or assistive technology, I want
the chat to be operable and announced, so that I can use it without a mouse or
sight.

#### Acceptance Criteria

1. THE Chat_UI SHALL make every interactive element reachable and operable by keyboard alone.
2. THE Chat_UI SHALL give every interactive element an accessible name.
3. WHEN streamed model output or a Tool_Call state change arrives, THE Chat_UI SHALL announce the change through a polite ARIA live region.
4. WHEN a Confirmation_Gate prompt opens, THE Chat_UI SHALL move keyboard focus to the prompt and return focus to the message input when the prompt closes.
5. THE Chat_UI SHALL convey Tool_Call state with text in addition to color.
6. THE Chat_UI SHALL meet WCAG 2.2 level AA contrast ratios for text and controls.

### Requirement 17: Live-change gate, build and checks

**User Story:** As the owner, I want the chat work held to the same live-change,
build and check policy as the cockpit work, so that the shared host is not
disrupted.

#### Acceptance Criteria

1. THE Implementer SHALL apply Cockpit_Spec Requirement 20 to every Chat_Interface task that would perform a Live_Change, including deploying or running the Chat_Interface under any Branch (Requirement 4.12), deploying the Chat_UI or Chat_Route, and changing grants.
2. THE Implementer SHALL run tests, linters, formatting checks and smoke fixtures for the Chat_Interface only on explicit owner request.
3. WHEN a build is required, THE Implementer SHALL build only the Chat_Interface package and, for any Rust target, only the required scoped target for `x86_64-unknown-linux-gnu` under Cockpit_Spec Requirement 21.
4. THE Implementer SHALL leave `/srv/git/odbus-verified`, `/srv/git/3tched.com`, `.kiro/steering/security-boundaries.md` and the Cockpit_Spec unmodified, except for the chat-code removal and the `ctl_plane_chatbot` coupling cut of Requirements 21 and 22, which steering `chat-clean-slate.md` records as the owner's exception.

### Requirement 18: Status, provenance and commits

**User Story:** As a judge, I want the chat component's status, provenance and
history reported honestly, so that I can separate proposed, built and deployed
work.

#### Acceptance Criteria

1. THE Status_Report SHALL state proposed, implemented, built, tested and deployed status separately for each Chat_Interface component and, for deployed status, for each Branch and Deployment_Target, as specified in Cockpit_Spec Requirement 22.
2. THE Provenance_Record SHALL list each Chat_Interface component with its path and the spec task identifiers from this spec that produced it.
3. THE Provenance_Record SHALL list each pinned dependency used by the Chat_Interface (op-dbus modules, `identity_sled`, the execution tracker, the grant materializer, the Operation_File contract, Door_8090, the Op_Web_Connector and the Pinned_Package_Set) with path or package name and pinned commit or version.
4. THE Provenance_Record SHALL cite this spec, the Cockpit_Spec and the steering file.
5. THE Implementer SHALL commit Chat_Interface work under Cockpit_Spec Requirement 24, with each commit focused on one task of this spec and the `.kiro` directory committed.
6. THE Hackathon_Repository Chat_Interface code, documentation and procedures SHALL address the Threetched_Surface only by `threetched` names, as specified in Cockpit_Spec Requirement 25.

### Requirement 19: Identity-neutral configuration

**User Story:** As the owner, I want one chat interface with no Branch baked into
its code, so that the same build serves the main 3tched identity, 3tchedW3,
subsidiaries and future Branches.

#### Acceptance Criteria

1. THE Chat_Interface source SHALL contain no Branch-specific session id, principal id, public key, container name, plugin allowlist or capability list.
2. WHEN the Chat_Route starts a Chat_Session, THE Chat_Route SHALL obtain each per-Branch value once, either from the Identity_Profile parsed by the Profile_Loader or from runtime discovery through the Bound_Identity's mounted namespace, SHALL take principal id, session id and public key only from the Bound_Identity_Record, SHALL take capabilities only from the Held_Capability_Set, and SHALL keep the obtained values unchanged for the lifetime of that Chat_Session, so that a later change to Identity_Profile data takes effect only for Chat_Sessions started after the change.
3. THE Implementer SHALL record in `design.md` the Identity_Profile format, schema and fields, limited to non-secret configuration data (display name, one mount path per View_Kind for each allowed Deployment_Target, allowed Deployment_Targets, a required field naming the principal id of the Branch the profile belongs to, and any further field that `design.md` classifies as non-secret), and SHALL record for each field its data type, whether it is required or optional, and its maximum length or element count, together with a maximum total Identity_Profile data size of no more than 64 KiB.
4. WHEN the Chat_Route starts a Chat_Session and Identity_Profile data is supplied, THE Profile_Loader SHALL parse the data on the server side into an Identity_Profile value according to the schema recorded in `design.md`, before any Tool_Registry is built or any Model_Provider request is sent for that Chat_Session.
5. IF Identity_Profile data contains Credential_Material, an executable value (any value outside the plain data types the schema recorded in `design.md` allows, such as code, a script or a function reference), a grant or capability list, or a field absent from the Identity_Profile schema, THEN THE Profile_Loader SHALL reject the whole Identity_Profile with an error naming each offending field, SHALL omit any detected Credential_Material from the error, log lines and the Chat_UI, and THE Chat_Route SHALL use no field of the rejected Identity_Profile and SHALL not start the Chat_Session.
6. THE Profile_Loader SHALL format each valid Identity_Profile value back into data in the format recorded in `design.md`, containing only fields present in the Identity_Profile schema.
7. FOR ALL valid Identity_Profile values, formatting then parsing SHALL produce an Identity_Profile value equal to the original in every field, including the element order of each list (round-trip property).
8. IF the current Deployment_Target, as determined at Chat_Session start by the method recorded in `design.md`, is absent from the allowed Deployment_Targets of the Identity_Profile, THEN THE Chat_Route SHALL refuse to start the Chat_Session, SHALL build no Tool_Registry and send no Model_Provider request for it, and SHALL create a Blocker_Record naming the Deployment_Target and the Bound_Identity.
9. THE Implementer SHALL provide a repository check that scans the Chat_Interface source using the detection rules recorded in `design.md`, reports each Branch-specific session id, principal id, public key, container name, plugin allowlist or capability list with its file path, line number and value category, writes no Credential_Material to its output, exits with a failure result when it reports one or more findings and with a success result otherwise, and exempts only synthetic values inside Synthetic_Fixtures.
10. THE Hackathon_Repository SHALL keep each Synthetic_Fixture free of every session id, principal id, public key and container name recorded for a real Branch in the Runtime_Record, and the repository check of criterion 9 SHALL report each such value found in a Synthetic_Fixture as a finding.
11. IF Identity_Profile data is absent, unreadable, not parseable in the format recorded in `design.md`, larger than the maximum size recorded in `design.md`, missing a required field, or holds a field value of the wrong data type or over its recorded maximum length or element count, THEN THE Profile_Loader SHALL reject the Identity_Profile with an error naming the field or condition, and THE Chat_Route SHALL not start the Chat_Session and SHALL fall back to no default or previously loaded Identity_Profile.
12. IF the principal id named in the Identity_Profile differs from the principal id in the Bound_Identity_Record, THEN THE Chat_Route SHALL refuse to start the Chat_Session, SHALL use no field of that Identity_Profile, and SHALL create a Blocker_Record naming both principal ids.
13. IF runtime discovery through the Bound_Identity's mounted namespace (including `identity_sled.get_own_identity`) fails or returns a Denial, THEN THE Chat_Route SHALL refuse to start the Chat_Session, SHALL not replace the missing values with Identity_Profile values, another identity or an alternate transport, and SHALL create a Blocker_Record naming the operation, the caller, the missing capability or policy if reported, and the error.

### Requirement 20: Multi-Branch isolation

**User Story:** As the owner, I want chat state partitioned by identity, so that
running the interface for several Branches never lets one Branch see or use
another Branch's data, confirmations or tools.

#### Acceptance Criteria

1. THE Chat_Interface SHALL key every server-side state entry by the principal id in the Bound_Identity_Record obtained under Requirement 4.1, and by no display name, Identity_Profile value, client-supplied value, host identifier or hardware identifier, where the keyed entries are Chat_Session records, message history, Tool_Registry state, Held_Capability_Set data, Confirmation_Gate pending Tool_Calls and Confirmation_Events, Unknown_Outcome reconciliation state, Chain_Verifier results, display cache entries and log lines.
2. THE Chat_Interface SHALL deliver data, streamed responses, tool results, Confirmation_Events and display cache entries only to Chat_Sessions whose Bound_Identity principal id equals the key of the delivered item.
3. IF a request, Tool_Call, Confirmation_Event or tool result carries a key different from the Bound_Identity principal id of the Chat_Session it is addressed to, THEN THE Chat_Interface SHALL reject the item without delivering, executing or storing it, SHALL leave every server-side state entry of both Bound_Identities unchanged (including pending Tool_Calls, which stay pending), and THE Secret_Guard SHALL record a redacted security event that names both Branches by display name and excludes Credential_Material.
4. THE Model_Context_Builder SHALL build each Model_Context only from server-side state entries keyed by the Chat_Session's own Bound_Identity principal id, so that the Model_Context contains no message, tool definition, tool result, display cache entry or Bound_Identity_Record field of any other Bound_Identity.
5. WHERE one Deployment_Target serves Chat_Sessions of more than one Branch, THE Tool_Executor SHALL execute each Tool_Call through the mounted namespace and kernel-bound caller of that Tool_Call's own Bound_Identity, and SHALL send no Operation_File call of that Tool_Call through the mounted namespace of any other Bound_Identity, including after a Denial or an Unknown_Outcome.
6. FOR ALL Bound_Identities A and B, the Tool_Registry derived for A SHALL depend only on A's Sealed_Method_Schemas and A's Held_Capability_Set, so that changing B's schemas or capabilities leaves A's Tool_Registry unchanged (isolation property).
7. FOR ALL event sequences across Branches, THE Tool_Executor SHALL execute no Mutation_Method Tool_Call of Bound_Identity A on the basis of a Confirmation_Event from a Chat_Session of Bound_Identity B different from A (isolation invariant).
8. FOR ALL interleavings of Chat_Sessions of different Bound_Identities given identical Operation_File results, the server-side state entries, streamed responses, display cache and Model_Contexts of each Chat_Session SHALL equal those produced when that Chat_Session runs alone with the same inputs (non-interference property).
9. IF a server-side read or write of Chat_Interface state carries no key, or carries a key that matches the Bound_Identity principal id of no active Chat_Session, THEN THE Chat_Interface SHALL reject the read or write, return no state entry, change no state entry, and THE Secret_Guard SHALL record a redacted security event that names the rejected channel and excludes Credential_Material.
10. IF the mounted namespace of Bound_Identity A is unavailable or an Operation_File call in it fails, THEN THE Tool_Executor SHALL end or hold A's Tool_Call as Requirement 8.6 specifies, SHALL keep executing Tool_Calls of every other Bound_Identity in that Bound_Identity's own mounted namespace, and SHALL route none of A's Tool_Calls to another Bound_Identity's mounted namespace.
11. WHEN a Chat_Session ends, including under Requirement 4.5, THE Confirmation_Gate SHALL discard the pending Tool_Calls of that Chat_Session only, and THE Chat_Interface SHALL leave every server-side state entry keyed by any other Bound_Identity unchanged.

### Requirement 21: Legacy chat removal

**User Story:** As the owner, I want every existing chat implementation removed
when it is encountered and the removal verified, so that the new interface is
the only chat and nothing old is used or left behind.

#### Acceptance Criteria

1. THE Chat_Interface SHALL import, copy, wrap, call or adapt no existing chat code, chat plugin, chat route, chat UI, chat service, chat store or chat protocol from op-dbus, the existing production UI or any other existing source (steering `chat-clean-slate.md`).
2. WHEN the Implementer encounters existing chat code, THE Implementer SHALL record in a Legacy_Chat_Inventory entry its path, symbol, pinned commit, callers traced in source, and whether it is chat code or an identity, grant or storage binding.
3. THE Implementer SHALL remove each Legacy_Chat_Inventory item classified as chat code completely: source files, module declarations, Cargo membership, plugin registration, sealed schema entry, generated code, routes, runit services, UI pages, tests, fixtures and docs that describe it as current, with no unreachable remnant and no compatibility shim.
4. IF a Legacy_Chat_Inventory item is an identity, grant or storage binding, or its role cannot be determined from source (for example a plugin whose name contains "chat" but that serves 3tchedFS receipts), THEN THE Implementer SHALL keep it unchanged and list it for the owner.
5. WHEN a removal is complete, THE Implementer SHALL verify it with a repository search showing no remaining reference to the removed symbols, paths, plugin ids or service names (outside archived history recorded as such), a passing scoped build for `x86_64-unknown-linux-gnu`, a catalog reseal that no longer contains the removed plugin, and a granted read through each of the two mounted views with its Receipt and authoritative read-back.
6. IF a removal breaks the scoped build, a remaining service or either mounted view, THEN THE Implementer SHALL restore the removed item from version control, record a Blocker_Record naming the dependency, and leave that removal in proposed status.
7. THE Implementer SHALL perform each removal in the shared op-dbus repository only after claiming it under that repository's handoff rules and never while another agent's build, seal or activation is running, and SHALL deploy a removal only with an Owner_Authorization (Live_Change).
8. WHEN the Implementer builds the Legacy_Chat_Inventory, THE Implementer SHALL ask the Jev decision model (steering `jev-decisions.md`) to classify each candidate and flag anomalies, record each question, model, answer, probabilities and confidence with the judged source paths, and confirm every classification with source evidence before acting, treating confidence below 0.6 as inconclusive.

### Requirement 22: Control-plane identity uses the new chat

**User Story:** As the owner, I want the existing control-plane identity kept
and switched to the new chat interface, so that the identity survives and its
chat runs only through the new code.

#### Acceptance Criteria

1. THE Implementer SHALL keep the control-plane identity, its session, credentials, grants, storage and container binding unchanged while removing legacy chat code.
2. WHEN legacy chat code that the control-plane identity used is removed, THE control-plane identity's chat SHALL run only through the Chat_Interface, bound under Requirement 4 to the identity returned by `identity_sled.get_own_identity` in its own mounted views.
3. THE Chat_Interface SHALL treat the control-plane identity as one Branch under Requirements 19 and 20, with no identity-specific code path.
4. WHEN the cutover is deployed, THE Implementer SHALL verify it by starting a Chat_Session under the control-plane identity, recording the `get_own_identity` Receipt, one granted read Tool_Call Receipt with its authoritative read-back, and a search showing no remaining call from that identity's services into removed chat code.
5. IF the control-plane identity cannot reach the Chat_Interface through an existing path recorded in `design.md` (Requirement 13), THEN THE Implementer SHALL record a Blocker_Record and keep both the identity and its current state unchanged.
6. THE Implementer SHALL keep the control-plane chat plugin `ctl_plane_chatbot` and SHALL classify it in the Legacy_Chat_Inventory as kept and integrated, not as chat code to remove.
7. THE Chat_Interface SHALL integrate `ctl_plane_chatbot` by deriving its methods into the Tool_Registry from the Bound_Identity's `3tched` view and calling them as Operation_File calls under Requirements 6 to 9, with no `ctl_plane_chatbot`-specific transport or bypass.
8. THE Implementer SHALL keep `chat_router` and other threetched-backed services in place as threetched services (not chat code), record their `chat_*` and former `tched_router` names as naming defects, and remove the `chat_router` imports and references inside `ctl_plane_chatbot` (types, size limits and plugin id) so that 3tched code does not depend on a threetched service, keep every other `ctl_plane_chatbot` method and record field, and verify under Requirement 21.5 that `ctl_plane_chatbot` still builds, is sealed in the catalog and answers a granted read through the `3tched` view.

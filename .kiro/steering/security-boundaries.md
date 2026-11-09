---
inclusion: always
---

# 3tchedW3 security boundaries (apply to every task)

These rules come from the owner's task brief for the Kiroween 2026 cockpit
work. They override convenience, test pressure and older prose.

## Scope of "root/cockpit"

- "Root/cockpit" names the control-plane role of the 3tchedW3 chatbot. It does
  not authorize a privileged Incus container, nesting, host-root access,
  broader grants, new credentials beyond 3tchedW3's own sealed identity, or
  any change to another identity, including the main 3tched identity.
- The `3tchedCockpitBot` / `3tchedCtlChatbot` / `CockpitBot3tched` names and
  the session `b0c777e3-0955-cd8b-3d01-ca12998cae28` belong to the main
  3tched identity. Never adopt, rename, repurpose or reference them as the
  3tchedW3 cockpit.

## Pinned dependencies

- op-dbus (`/srv/git/odbus-verified`), 3tchedFS, `identity_sled`, the
  identity-bound container architecture and `op-identity-root` are pinned
  pre-existing dependencies. Read them; do not modify them. Use them only
  through their existing interfaces. Cite them in `PROVENANCE.md`.
- Hackathon code lives only in this repository and must stay separable from
  pre-existing code. Call existing contracts; never copy them.

## Operations and verification

- Act through the assigned identity's mounted 3tchedFS operation files
  (`operations/<plugin>/<method>/call`). Discover arguments, results and
  errors there.
- Completion requires the operation receipt and the resulting authoritative
  state, not a successful local write.
- A denial is a permission boundary. Record operation, caller, missing
  capability or policy and error. Never bypass it with direct database
  edits, alternate transports, another identity, raw Incus commands or the
  chain.

## Storage and lifecycle

- Preserve the immutable shared seed, the identity-specific writable leaf and
  the existing seven subvolumes (`@`, `@agent_memory`, `@agent_rules`,
  `@agent_shared`, `@agent_skills`, `@agent_soul`, `@agent_user`).
- Only the authorized external host provisioner may add a blank leaf, once,
  during explicit creation. Login, start, stop, restart, logout, recovery and
  failed-start cleanup must never add or remove Btrfs members.
- If a cockpit created during the hackathon exists, keep its identity, native
  UUID, credentials, grants and storage. Do not duplicate or reimage it.

## Surfaces and network

- Preserve both guest filesystem views (`/run/mounts/3tchedFS`,
  `/run/mounts/threetched`) and their sealed catalog and identity
  enforcement.
- No MCP in the product, no new control plane, no extra inbound network door.
  The container's only host channel is the lungs socket
  (`/run/opdbus/lungs/lungs.sock`). Kiro's own development tooling is
  separate and does not count.
- Chain access is outbound only, through an existing egress path that
  `design.md` names explicitly.

## Chain and keys

- Testnet only. No mainnet deployment, token spend, or signed transaction
  from a funded key without separate explicit owner authorization.
- The sealed 3tched identity stays authoritative. The Web3 side is a
  verifiable mirror or attestation, never a second source of truth.
- The binding must not depend on any host or hardware identifier.
- Chain-anchored data is derived from existing receipts and the audit chain,
  never written in place of them.
- Key material belongs only to the 3tchedW3 identity, stays sealed inside it,
  and is never exported to the host, logs, or this repository. Never publish
  or hash-anchor a SID1 credential.

## Live-system changes

- Read-only discovery and reversible source changes in this repository are
  authorized. Changing live identities, grants, storage or deployments,
  restarting services, or creating a live container needs separate explicit
  owner authorization.

## Build and checks

- Make the smallest evidence-backed change. Build only the required scoped
  target for `x86_64-unknown-linux-gnu`.
- Tests, Clippy, formatting checks and smoke fixtures run only on explicit
  request. No workspace-wide Cargo command without an explicit workspace
  request. Never run two Cargo processes at once.
- Report proposed, implemented, built, tested and deployed status separately.

## Commits

- Focused commits inside the submission window (opened 2026-10-30). Do not
  backdate. Do not fold pre-hackathon history into hackathon commits.

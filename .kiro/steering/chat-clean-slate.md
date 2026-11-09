---
inclusion: always
---

# Chat clean slate (owner, non-negotiable)

Owner rule, 2026-11-08: for chat development no existing code is used.
Anything chat related in existing code is removed when encountered, and its
full removal and the remaining system's functionality are verified.

- The chat interface (`.kiro/specs/identity-chat-interface/`) is written
  fresh in this repository. Do not import, copy, wrap, call or adapt any
  existing chat code, chat plugin, chat route, chat UI, chat service, chat
  store or chat protocol, in op-dbus (`/srv/git/odbus-verified`), the
  production UI (`/srv/git/3tched.com`) or anywhere else.
- This rule is the owner's explicit exception to "pinned dependencies are
  read-only" in `security-boundaries.md`, for chat code only. All other
  pinned code stays read-only.
- When chat code is encountered, record it (path, symbol, pinned commit,
  callers) and remove it completely: source, module and Cargo membership,
  plugin registration and sealed schema, generated code, routes, runit
  services, UI pages, tests, fixtures and docs that describe it as current.
  Leave no unreachable remnant and no compatibility shim.
- Verify removal and functionality: no reference to the removed code
  remains (search evidence), the scoped build for `x86_64-unknown-linux-gnu`
  passes, the catalog reseal no longer contains the removed plugin, and the
  remaining services and both 3tchedFS views still work (receipts and
  authoritative read-back). This rule is the owner's explicit request for
  that verification.
- Keep the identity (owner, 2026-11-08: "don't remove the identity, make
  sure it is using the new chat"). The control-plane identity
  (`OP_CONTROL_PLANE_CHATBOT_*`, `chatbot-identity`, identity_sled container
  bindings), its grants and storage are not chat code and are never removed.
  That identity must use the new chat interface: once the old chat code is
  gone, its chat runs only through the new interface, bound to it through
  `identity_sled.get_own_identity` in its own mounted views.
- Keep the control-plane chat plugin `ctl_plane_chatbot` (owner,
  2026-11-08). It stays and is integrated into the new chat: the new chat
  calls its operations (episodes, knowledge, context, significance, config)
  through the identity's mounted `3tched` view like any other granted
  tool. Its current code imports `chat_router` types and limits
  (`ctl_plane_chatbot.rs`, `ctl_plane_chatbot_methods.rs`); removing
  `chat_router` must cut that dependency inside `ctl_plane_chatbot` without
  removing the plugin or changing its schema contract beyond the removed
  `chat_router` coupling.
- Not chat code: threetched-backed services (owner, 2026-11-08). The
  transports and routes that run on the ZeroClaw-derived binary, including
  the plugin currently named `chat_router` (renamed from `tched_router` in
  `71fa232`; its paths point at `/usr/bin/threetched`), are threetched
  services. They are not removed as chat code. Under
  `naming-3tched-threetched.md` they are threetched, so the `chat_*` /
  `tched_router` names on them are naming defects to record and fix, and
  they are reached only through the `threetched` view.
- Also not chat code: other identity, grant and storage bindings and the
  threetched surface. For anything whose name says chat but whose role is
  unclear, list it and ask the owner before touching it; never change
  another identity, grant or storage.
- Removal in a shared repository follows its handoff rules (claim, one owner
  per file, never during another agent's build, seal or activation).
  Deploying a removal is a Live_Change that needs owner authorization.

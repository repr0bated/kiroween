---
inclusion: always
---

# Naming rule: 3tched vs threetched (owner, non-negotiable)

Owner rule, 2026-11-08, verbatim:

> threetched is anything that runs on the zeroclaw backed binary. 3tched is
> anything that runs on our code.

Apply it to every name in code, specs, docs, commits and conversation:

- **threetched**: anything that runs on the ZeroClaw-derived executable
  (`/usr/bin/threetched`). Its operations appear in the `/run/mounts/threetched`
  view under the `threetched` plugin.
- **3tched**: anything that runs on our own code: op-dbus, the bridge, our
  filesystem `3tched-fs` (`/run/mounts/3tchedFS`), identity_sled, and all
  hackathon code in this repository, including the chat interface.
- Classify by what actually runs the thing, not by its current name in source.
  If a pinned name contradicts this rule (for example `tched_router` /
  `tched-router` for the threetched surface), the name is a defect: record it
  and never use it as an interface name.
- Never use any other spelling or alias for either side, including
  `tched_router`, `tched-router`, `zeroclaw` as a product or service name, or
  `threetched` for our code.

## The rule is the FUSE separation and the call path

Owner, 2026-11-08: the same rule decides how the FUSE filesystem is split
and where each call is made.

- `/run/mounts/3tchedFS` exposes only what runs on our code (3tched). Calls
  to those operations go through `/run/mounts/3tchedFS/operations/...`.
- `/run/mounts/threetched` exposes only what runs on the ZeroClaw-derived
  binary (threetched). Calls to those operations go through
  `/run/mounts/threetched/operations/...`.
- Choose the view from what runs the operation, never from convenience. Never
  call a 3tched operation through the threetched view or a threetched
  operation through the 3tchedFS view, and never route a call to the other
  view after a denial or error.
- Both views use the same 3tched-fs FUSE engine, sealed catalog and identity
  enforcement; the split is by what runs the operation, not a second
  control plane.
- The chat and every container use both views at the same time. Mounting
  only one view, or treating them as alternatives, is wrong.
- Why the split exists (owner, 2026-11-08): when the ZeroClaw-derived binary
  upgrades, everything it runs changes on its own side of a clean line. A
  threetched upgrade touches only the threetched view; 3tched code and the
  3tchedFS view stay unchanged, and nothing of ours depends on threetched
  internals.

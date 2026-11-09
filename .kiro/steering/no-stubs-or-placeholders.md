---
inclusion: always
---

# No stubs or placeholders (owner)

Owner rule, 2026-11-08: do not write stubs, placeholders, or dummy implementations.

- **No stubs**: Every function must have a complete implementation, not a stub that logs and returns a default value.
- **No placeholders**: Do not write `// TODO`, `// FIXME`, `// XXX`, or any comment indicating incomplete work.
- **No dummy data**: Do not return fake data or mock values that don't reflect real implementation.
- **No partial implementations**: If a feature is not ready, do not implement a partial version that will need to be replaced later.

**When a task requires a component that is not yet ready:**
1. Record the blocker in the Runtime_Record or as a Blocker_Record
2. Leave the task in proposed status
3. Do not write a stub or placeholder as a temporary solution

This rule ensures that once code is deployed, it is production-ready and requires no follow-up stub removal.

---
inclusion: always
---

# Defer tests and verification until deployment (owner)

Owner rule, 2026-11-08: for the chat interface implementation, defer all tests
and verification until after deployment.

- **Tests**: Property tests, unit tests, and integration tests are deferred.
  Write test files but do not run them. Run tests only after the implementation
  is deployed and confirmed working in production.
- **Verification**: Code review, linting, type checking, and build verification
  are deferred. Ensure code compiles and passes checks, but do not run the full
  test suite or verification steps until deployment is complete.
- **Rationale**: The chat interface is new code with no production risk. Running
  tests and verification upfront delays progress; deployment comes first.
- **Post-deployment**: After deployment, run all tests and verification to
  establish a baseline. Any failures indicate pre-deployment issues.

---
inclusion: always
---

# Use the Jev decision model heavily during development (owner)

Owner, 2026-11-08: the Jev decision model (TypeSafe) is used heavily during
development. It helps identify anomalies in the old chat code.

- Endpoint: `POST https://api.typesafe.ai/v1/systemone` (typed questions:
  `noul`, `choice`, `score`), `GET /v1/models`. Default model `jev-latest`
  (`jev-preview` also available). Key: `TYPESAFE_API_KEY` in
  `~/.omp/agent/.env`; load it into the environment of the call only, never
  print, log, commit or copy it.
- Use Jev for development judgments: classifying legacy code (chat code,
  threetched-backed service, identity/grant/storage binding, unclear),
  spotting anomalies (dead paths, naming-rule violations, 3tched code
  depending on threetched internals, duplicate chat stacks, bypasses of
  operation files or grants), routing and ranking candidates, and checking
  claims against evidence (verify).
- Jev answers are evidence, not authority. Record the question, model,
  answer, probabilities and confidence with the source paths it judged.
  Treat confidence below 0.6 as inconclusive and confirm with source
  evidence (grep, caller trace, build) before acting. A Jev answer never
  authorizes a removal, a Live_Change or a grant change on its own.
- Send only source code and non-secret text. Run the credential check first;
  never send SID1, OIA1, keys, `.env` content, grant files or identity
  records to Jev.
- Jev is development tooling. It is not part of the product chat and is
  not a Model_Provider for the Chat_Interface.

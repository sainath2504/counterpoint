# Threat model

Protected assets: decision ownership, source confidentiality, revision integrity, provider credentials, inference budget, and availability.

| Threat | Current control | Remaining risk / extension |
|---|---|---|
| Cross-user access | Hosted user ID on every storage predicate; non-owners get not-found | Trust and review gateway access |
| Stale overwrite | Expected revision and atomic conditional append | Add a three-way merge UI |
| Duplicate write | Request ID plus content fingerprint | Callers retain IDs across retries |
| Prompt injection | Sources marked untrusted; no tools; deterministic ranking | Live injection evaluations before connectors |
| Hallucinated citation | Enabled source ID and exact excerpt checks | Entailment and truth remain human judgments |
| Secret leakage | Server binding, generic provider errors, ignored environments | Hosted rotation and egress policy |
| Cost abuse | Authenticated action, D1 quota, timeout, output cap | Organization budgets and monitoring |
| Cross-site write | Exact same-origin writes | Continue framework/platform review |
| Oversized payload | Client/server size, count and length limits | Upstream limits too |
| Database rewrite | Hash-linked snapshots and portable verification | Signed immutable external checkpoints |
| Local-demo exposure | Flag, loopback URL and loopback bind | Never a multi-user boundary |
| Misleading certainty | Coverage abstention, intervals and visible caveats | Calibrate against outcomes before prediction claims |

Tests cover ownership, parameterized SQL, stale writes, idempotency, injection text, validation, quota and proof. This is not an independent security audit or certification.

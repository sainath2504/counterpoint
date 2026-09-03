# Learning path

Each module names one concept, implementation, and experiment.

## Module 0 — A decision is a data model

Read `lib/domain.ts` and `lib/fixtures.ts`. Evidence, assessments, alternatives and priorities are different records.

Try it: add one criterion. Decide whether “higher” always means better before scoring.

## Module 1 — Deterministic uncertainty

Read `lib/engine.ts` and ADR 002. Trace one cell from sources to interval and trial result.

Try it: replace the shared criterion quantile with independent draws. Explain the independence assumption you introduced.

## Module 2 — Untrusted boundaries

Read `parseDecision` and hostile-input tests. TypeScript disappears at network/file boundaries; runtime checks protect the program.

Try it: import a file whose quote is absent from its source. Confirm the draft remains unchanged.

## Module 3 — AI without authority

Read `lib/provider.ts`, the review route and `docs/ai-boundary.md`. The model comments on an analysis it cannot mutate.

Try it: make a mocked response fabricate a quote and watch local validation reject it.

## Module 4 — Safe persistence

Read `lib/repository.ts`, the migration and ADR 003. Expected revision is compare-and-swap; request ID plus fingerprint is idempotency.

Try it: send two saves with one expected revision. Prove one conflicts without destroying either draft.

## Module 5 — Tamper evidence

Read `lib/proof.ts`. Canonical JSON makes equivalent objects hash consistently; revisions include their parent.

Try it: change one character in exported history and verify. Explain why an administrator could still rewrite everything.

## Module 6 — Product truthfulness

Read the method screen, threat model and limitations. Language is part of the safety boundary.

Try it: classify every visible number as input, result, measurement or policy. Rewrite ambiguity.

## Module 7 — Operate the release

Run `pnpm check`, apply the migration, inspect health, then save, reload and replay.

Try it: retry one save request and prove no duplicate revision appears.

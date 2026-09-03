# Architecture

Counterpoint is decision support, not a decision-maker. Persuasive prose cannot gain authority over its comparison or saved record.

## Trust boundaries

| Boundary | Untrusted input | Enforcement |
|---|---|---|
| Import | Arbitrary JSON | Size, schema, count, length, finite-range, ID, duplicate and exact-quote checks |
| Browser → API | Drafts and IDs | Same-origin writes, body limit, runtime validation and server identity |
| Model → app | Structured fallible output | Provider schema, local parse, enabled-source and exact-excerpt checks |
| User → storage | Stale/repeated writes | Owner predicate, expected revision, fingerprint and conditional append |
| Storage → verifier | Potentially altered history | Complete sequence, parent link and digest recomputation |

## Deterministic engine

Enabled evidence contributes a score interval per alternative and criterion. Reliability-weighted intervals are used when sources overlap. If sources do not overlap, the full minimum-to-maximum range is preserved. The midpoint comparison is:

```text
score(alternative) = Σ normalized_priority(criterion) × midpoint(cell)
```

Missing cells are `[0, 100]` with midpoint `50`; a separate coverage gate withholds the recommendation. A seeded stress test draws one shared uniform quantile per criterion, modeling correlated outcomes across alternatives. It is deliberately inspectable—not a probability distribution learned from outcomes.

Counterpoint abstains if priorities are all zero, leaders tie, or any option has under 60% weighted coverage. A `supported` lead also needs a three-point midpoint margin and 75% win share. These are versioned product policy, not scientific constants.

## Persistent revisions

Each decision belongs to the authenticated Sites user. Every save supplies an expected revision. One conditional `INSERT … SELECT` appends only if the latest revision still matches; the composite primary key prevents two concurrent winners. Request IDs plus fingerprints make exact retries idempotent.

Snapshots are canonicalized by sorting object keys while preserving array order. A digest covers the engine version, identity, revision, parent digest, complete snapshot, timestamp and note. This detects alteration against a trusted checkpoint. An administrator who rewrites the entire database can recompute the chain; stronger assurance needs signed external checkpoints.

Hosted identity comes from Sites-authenticated headers and authorization remains server-side. Local mode requires an explicit flag plus a loopback URL; development binds to `127.0.0.1`. The browser holds only transient UI state. API credentials never enter browser code, snapshots, exports, logs, or screenshots.

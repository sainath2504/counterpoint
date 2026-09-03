# ADR 003 — Append snapshots with optimistic concurrency

**Status:** accepted

Mutable rows erase how evidence changed; generic event sourcing adds abstraction without helping this bounded workflow. Save complete validated snapshots as numbered revisions, using one conditional append, an idempotency fingerprint and hash links.

Replay is simple and history survives. Storage grows, edits require a version check, and each decision is capped at 100 revisions. Hashes remain relative to a trusted checkpoint.

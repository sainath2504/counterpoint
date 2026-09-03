# Counterpoint

> Good decisions survive a little opposition.

Counterpoint is an evidence-backed decision studio. It makes the assumptions behind a recommendation visible, lets you change priorities and remove sources, and preserves a replayable record of what changed.

![Counterpoint — evidence, trade-offs, decisions](public/og.png)

## Why this is different

Most decision dashboards compress uncertainty into one confident score. Counterpoint keeps four things separate:

1. **Evidence** — source text and exact excerpts.
2. **Judgment** — bounded assessments and explicit reliability weights.
3. **Values** — priorities set by the decision-maker.
4. **Commentary** — deterministic or optional model-written challenges that cannot change the ranking.

The application asks: **what would have to change for the recommendation to change?**

## Product tour

- Compare two to five alternatives against weighted criteria.
- Trace score intervals to exact source excerpts.
- Preserve disagreement as wider uncertainty instead of averaging it away.
- Sweep a priority to find tipping points; remove sources to test dependence.
- Review advocate, skeptic, and auditor perspectives without pretending they are independent agents.
- Save append-only revisions with conflict detection and SHA-256 hash links.
- Import/export validated JSON and evidence-rich Markdown.
- Let compatible agents read analysis or stage priorities through bounded WebMCP tools.

The two included scenarios are synthetic. Ranking, counterfactuals, persistence, conflicts, exports, and proof verification are real computations.

## Run locally

Requirements: Node.js 22+ and pnpm 11.

```powershell
Copy-Item .dev.vars.example .dev.vars
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

Open `http://127.0.0.1:3100`. Local demo mode uses one labeled local owner. Never expose it to a network.

## Optional live review

Counterpoint works without an API key. To enable one explicit live-review action, set both values only in the server environment:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

The browser never receives the key. One schema-constrained Responses API call uses disabled provider storage, a per-user quota, timeout, output limit, and exact-excerpt citation checks. It never substitutes demo output for provider failure. See [AI boundary](docs/ai-boundary.md).

## Verify the release

```powershell
pnpm check
```

This runs linting, strict TypeScript, 59+ behavior tests, and a production Worker build. Persistence tests apply the generated migration to real in-memory SQLite rather than mocking storage.

## Architecture

```text
source text ─► cited excerpt ─► bounded judgment ─┐
                                                  ├─► deterministic engine
decision-maker ───────────────► explicit values ─┘            │
                      ┌────────────────────────────────────────┤
                      ▼                    ▼                   ▼
                 comparison           stress lab         AI challenge
                      └────────────────────┬───────────────────┘
                                           ▼
                              revision + hash link + D1 owner
```

Read the [architecture](docs/architecture.md), [threat model](docs/threat-model.md), [decision records](docs/decisions/), and [learning path](docs/learning-path.md).

## Honest limitations

- Scores and reliability values are analyst judgments, not facts inferred from evidence.
- Stress-test win share is sensitivity inside this model, not a calibrated success probability.
- Exact-quote checking proves attribution, not entailment or truth.
- Revision hashes detect changes against a retained checkpoint; they are not signatures or immutable storage.
- Hosted identity depends on trusted Sites gateway headers. Local demo identity is not authentication.
- Live AI is tested with provider-shaped mocks but is not exercised with a paid account in CI.
- Vinext is beta software; evaluate the pinned version before adopting this architecture elsewhere.

## Repository map

| Location | Responsibility |
|---|---|
| `lib/domain.ts` | Runtime boundary for decisions and model output |
| `lib/engine.ts` | Comparison, coverage policy, ablation and sensitivity |
| `lib/provider.ts` | Bounded optional Responses API adapter |
| `lib/repository.ts` | Owner isolation, idempotency and compare-and-swap revisions |
| `lib/proof.ts` | Canonical JSON and SHA-256 verification |
| `components/` | Accessible workspace and WebMCP interface |
| `app/api/` | Identity, storage and inference boundaries |
| `tests/` | Invariants, hostile inputs, persistence races and provider failures |

MIT © Sainath Vangipuram

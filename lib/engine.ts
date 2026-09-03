import type { Analysis, Cell, Decision } from './domain';

export const ENGINE_VERSION = '1.0.0';
export const TRIALS = 512;
export function normalizedWeights(decision: Decision): Record<string, number> {
  const total = decision.criteria.reduce((sum, c) => sum + c.weight, 0);
  return Object.fromEntries(
    decision.criteria.map((c) => [c.id, total ? c.weight / total : 0]),
  );
}
export function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function analyze(decision: Decision, trials = TRIALS): Analysis {
  if (!Number.isInteger(trials) || trials < 1 || trials > 4096)
    throw new Error('Trials must be an integer between 1 and 4096.');
  const weights = normalizedWeights(decision);
  const sources = decision.sources
    .filter((s) => s.enabled && s.reliability > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const cells: Cell[] = decision.alternatives.flatMap((alt) =>
    decision.criteria.map((c) => {
      const evidence = sources.flatMap((s) =>
        s.assessments
          .filter((a) => a.alternativeId === alt.id && a.criterionId === c.id)
          .map((a) => ({ source: s, assessment: a })),
      );
      const reliability = evidence.reduce(
        (sum, e) => sum + e.source.reliability,
        0,
      );
      const low = reliability
        ? evidence.reduce(
            (sum, e) => sum + e.assessment.low * e.source.reliability,
            0,
          ) / reliability
        : 0;
      const high = reliability
        ? evidence.reduce(
            (sum, e) => sum + e.assessment.high * e.source.reliability,
            0,
          ) / reliability
        : 100;
      const contested = evidence.some((a) =>
        evidence.some((b) => a.assessment.high < b.assessment.low),
      );
      // Conflicting sources widen the range instead of averaging disagreement away.
      const boundLow = contested
        ? Math.min(...evidence.map((e) => e.assessment.low))
        : low;
      const boundHigh = contested
        ? Math.max(...evidence.map((e) => e.assessment.high))
        : high;
      return {
        alternativeId: alt.id,
        criterionId: c.id,
        low: boundLow,
        high: boundHigh,
        midpoint: (low + high) / 2,
        sourceIds: evidence.map((e) => e.source.id),
        contested,
      };
    }),
  );
  const rankings = decision.alternatives
    .map((alt) => {
      const relevant = cells.filter((c) => c.alternativeId === alt.id);
      return {
        alternativeId: alt.id,
        score: relevant.reduce(
          (s, c) => s + c.midpoint * weights[c.criterionId],
          0,
        ),
        low: relevant.reduce((s, c) => s + c.low * weights[c.criterionId], 0),
        high: relevant.reduce((s, c) => s + c.high * weights[c.criterionId], 0),
        wins: 0,
        coverage: relevant.reduce(
          (s, c) => s + (c.sourceIds.length ? weights[c.criterionId] : 0),
          0,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.alternativeId.localeCompare(b.alternativeId),
    );
  const random = randomGenerator(decision.seed);
  for (let trial = 0; trial < trials; trial++) {
    // One shared quantile per criterion models correlated outcomes across alternatives.
    const quantiles = Object.fromEntries(
      [...decision.criteria]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => [c.id, random()]),
    );
    const outcomes = rankings.map((r) => ({
      id: r.alternativeId,
      score: cells
        .filter((c) => c.alternativeId === r.alternativeId)
        .reduce(
          (sum, c) =>
            sum +
            (c.low + (c.high - c.low) * quantiles[c.criterionId]) *
              weights[c.criterionId],
          0,
        ),
    }));
    const max = Math.max(...outcomes.map((o) => o.score));
    const tied = outcomes.filter((o) => Math.abs(o.score - max) < 1e-9);
    for (const r of rankings)
      if (tied.some((t) => t.id === r.alternativeId)) r.wins += 1 / tied.length;
  }
  for (const r of rankings) r.wins /= trials;
  const [first, second] = rankings;
  const margin = first.score - second.score;
  const hasWeight = Object.values(weights).some((v) => v > 0);
  const covered = rankings.every((r) => r.coverage >= 0.6);
  const enough = hasWeight && covered;
  const status = !enough
    ? 'insufficient'
    : margin >= 3 && first.wins >= 0.75
      ? 'supported'
      : 'conditional';
  const warnings: string[] = [];
  if (!hasWeight) warnings.push('Set at least one priority above zero.');
  if (!covered)
    warnings.push(
      'At least one alternative has less than 60% weighted evidence coverage. Withhold a recommendation.',
    );
  if (cells.some((c) => c.contested))
    warnings.push(
      'Some sources disagree. Their full score range is preserved in stress tests.',
    );
  if (enough && status === 'conditional')
    warnings.push(
      'The lead is small or assumption-sensitive. Gather evidence before committing.',
    );
  return {
    rankings,
    cells,
    trials,
    winnerId: enough && margin > 1e-9 ? first.alternativeId : null,
    status,
    margin,
    warnings,
  };
}
export function ablations(decision: Decision) {
  const baseline = analyze(decision, 128);
  const leading = baseline.rankings[0];
  return decision.sources
    .filter((s) => s.enabled && s.reliability > 0)
    .map((source) => {
      const result = analyze(
        {
          ...decision,
          sources: decision.sources.map((s) =>
            s.id === source.id ? { ...s, enabled: false } : s,
          ),
        },
        128,
      );
      return {
        sourceId: source.id,
        title: source.title,
        winnerId: result.winnerId,
        status: result.status,
        scoreDelta:
          (result.rankings.find(
            (r) => r.alternativeId === leading.alternativeId,
          )?.score ?? 0) - leading.score,
        changesWinner: result.winnerId !== baseline.winnerId,
      };
    })
    .sort(
      (a, b) =>
        Number(b.changesWinner) - Number(a.changesWinner) ||
        Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta),
    );
}
export function sensitivity(decision: Decision, criterionId: string) {
  const others = decision.criteria.filter((c) => c.id !== criterionId);
  const sum = others.reduce((s, c) => s + c.weight, 0);
  return Array.from({ length: 21 }, (_, i) => {
    const weight = i * 5;
    const next = {
      ...decision,
      criteria: decision.criteria.map((c) => ({
        ...c,
        weight:
          c.id === criterionId
            ? weight
            : (100 - weight) * (sum ? c.weight / sum : 1 / others.length),
      })),
    };
    const result = analyze(next, 64);
    return {
      weight,
      winnerId: result.winnerId,
      scores: Object.fromEntries(
        result.rankings.map((r) => [r.alternativeId, r.score]),
      ),
    };
  });
}

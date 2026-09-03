import type { Analysis, Argument, Decision, Deliberation } from './domain';
export function deterministicReview(
  decision: Decision,
  analysis: Analysis,
): Deliberation {
  const leading = analysis.rankings[0];
  const alternative = decision.alternatives.find(
    (a) => a.id === leading.alternativeId,
  )!;
  const sources = decision.sources.filter(
    (s) => s.enabled && s.reliability > 0,
  );
  const relevant = sources.flatMap((s) =>
    s.assessments
      .filter((a) => a.alternativeId === leading.alternativeId)
      .map((a) => ({ source: s, assessment: a })),
  );
  const strongest = [...relevant].sort(
    (a, b) =>
      b.assessment.low +
      b.assessment.high -
      (a.assessment.low + a.assessment.high),
  )[0];
  const weakest = [...relevant].sort(
    (a, b) =>
      a.assessment.low +
      a.assessment.high -
      (b.assessment.low + b.assessment.high),
  )[0];
  const cite = (entry: typeof strongest) =>
    entry ? [{ sourceId: entry.source.id, quote: entry.assessment.quote }] : [];
  const arguments_: Argument[] = [
    {
      perspective: 'advocate',
      title: `The case for ${alternative.name}`,
      body: analysis.winnerId
        ? `${alternative.name} leads the weighted midpoint comparison by ${analysis.margin.toFixed(1)} points. Its strongest cited assessment is ${strongest ? decision.criteria.find((c) => c.id === strongest.assessment.criterionId)?.name : 'not yet documented'}. This supports a candidate for further review, not a verified outcome.`
        : 'There is not enough weighted evidence, or the alternatives are tied. Withhold a recommendation and fill the missing cells before interpreting the scores.',
      citations: cite(strongest),
    },
    {
      perspective: 'skeptic',
      title: 'What could overturn the lead?',
      body: weakest
        ? `The weakest cited assessment for ${alternative.name} is ${decision.criteria.find((c) => c.id === weakest.assessment.criterionId)?.name}, scored ${weakest.assessment.low}–${weakest.assessment.high}. Exclude its source or increase this criterion’s priority in the stress lab. Check whether the candidate changes before committing.`
        : 'No cited assessments support a challenge yet. Add a source with an exact quote and a defensible score interval.',
      citations: cite(weakest),
    },
    {
      perspective: 'auditor',
      title: 'Separate the evidence from the judgment',
      body: `${sources.length} active sources feed ${analysis.cells.filter((c) => c.sourceIds.length > 0).length} of ${analysis.cells.length} comparison cells. ${analysis.cells.filter((c) => c.contested).length} cells contain non-overlapping assessments. Source excerpts are checked literally; that does not prove the assigned scores or conclusions follow from them. Inspect the mapping yourself.`,
      citations: cite(strongest),
    },
  ];
  return {
    mode: 'deterministic',
    arguments: arguments_,
    model: null,
    inputTokens: null,
    outputTokens: null,
    durationMs: 0,
  };
}

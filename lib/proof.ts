import { ENGINE_VERSION } from './engine';
import type { Decision, Revision } from './domain';
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(',')}}`;
  throw new Error('Proofs require finite JSON values.');
}
export async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function revisionDigest(revision: Omit<Revision, 'digest'>) {
  return digest({ engineVersion: ENGINE_VERSION, ...revision });
}
export async function verifyHistory(history: Revision[]): Promise<boolean> {
  if (!history.length) return false;
  let parent = 'genesis';
  let index = 1;
  const decisionId = history[0].decisionId;
  for (const row of history) {
    if (
      row.decisionId !== decisionId ||
      row.revision !== index++ ||
      row.parentDigest !== parent
    )
      return false;
    const { digest: actual, ...payload } = row;
    if ((await revisionDigest(payload)) !== actual) return false;
    parent = actual;
  }
  return true;
}
export function decisionMarkdown(decision: Decision, summary: string): string {
  return `# ${decision.title}\n\n${decision.context}\n\n## Result\n\n${summary}\n\n## Priorities\n\n${decision.criteria.map((c) => `- ${c.name}: ${c.weight}`).join('\n')}\n\n## Evidence\n\n${decision.sources.map((s) => `### ${s.id}: ${s.title}\n\nStatus: ${s.enabled ? 'included' : 'excluded'}; analyst reliability weight: ${s.reliability}\n\n${s.text}\n\n${s.assessments.map((a) => `- ${a.alternativeId} / ${a.criterionId}: ${a.low}–${a.high}. Evidence: ${a.quote}`).join('\n')}`).join('\n\n')}\n\n## Reproducibility\n\nEngine ${ENGINE_VERSION}; seed ${decision.seed}. Stress-test win shares describe the model's assumptions, not real-world probabilities. Scores are analyst judgments, not facts extracted from the source.\n`;
}

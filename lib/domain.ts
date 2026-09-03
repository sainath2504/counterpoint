export type Criterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
};
export type Alternative = { id: string; name: string; description: string };
export type Assessment = {
  alternativeId: string;
  criterionId: string;
  low: number;
  high: number;
  quote: string;
};
export type Source = {
  id: string;
  title: string;
  kind: 'benchmark' | 'interview' | 'estimate' | 'document';
  text: string;
  reliability: number;
  enabled: boolean;
  assessments: Assessment[];
};
export type Decision = {
  schemaVersion: 1;
  title: string;
  context: string;
  alternatives: Alternative[];
  criteria: Criterion[];
  sources: Source[];
  seed: number;
};
export type Cell = {
  alternativeId: string;
  criterionId: string;
  low: number;
  high: number;
  midpoint: number;
  sourceIds: string[];
  contested: boolean;
};
export type Ranking = {
  alternativeId: string;
  score: number;
  low: number;
  high: number;
  wins: number;
  coverage: number;
};
export type Analysis = {
  rankings: Ranking[];
  cells: Cell[];
  trials: number;
  winnerId: string | null;
  status: 'supported' | 'conditional' | 'insufficient';
  margin: number;
  warnings: string[];
};
export type Argument = {
  perspective: 'advocate' | 'skeptic' | 'auditor';
  title: string;
  body: string;
  citations: { sourceId: string; quote: string }[];
};
export type Deliberation = {
  mode: 'deterministic' | 'live';
  arguments: Argument[];
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
};
export type SavedDecision = {
  id: string;
  title: string;
  revision: number;
  digest: string;
  updatedAt: string;
};
export type Revision = {
  decisionId: string;
  revision: number;
  parentDigest: string;
  digest: string;
  snapshot: Decision;
  createdAt: string;
  note: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object.');
  return Object.fromEntries(Object.entries(value));
}
function string(value: unknown, label: string, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${label} must contain 1–${max} characters.`);
  return value.trim();
}
function number(value: unknown, label: string, min = 0, max = 100): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}
function array(
  value: unknown,
  label: string,
  min: number,
  max: number,
): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(`${label} requires ${min}–${max} entries.`);
  return value;
}
function id(value: unknown): string {
  const result = string(value, 'Identifier', 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new Error('Invalid identifier.');
  return result;
}
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}.`);
}

/** Runtime validation is shared by imports, storage, agent tools and HTTP boundaries. */
export function parseDecision(input: unknown): Decision {
  const d = record(input);
  if (d.schemaVersion !== 1)
    throw new Error('Unsupported decision schema. Expected version 1.');
  const alternatives = array(d.alternatives, 'Alternatives', 2, 5).map((v) => {
    const r = record(v);
    return {
      id: id(r.id),
      name: string(r.name, 'Alternative', 80),
      description: string(r.description, 'Description', 500),
    };
  });
  const criteria = array(d.criteria, 'Criteria', 2, 6).map((v) => {
    const r = record(v);
    return {
      id: id(r.id),
      name: string(r.name, 'Criterion', 60),
      description: string(r.description, 'Description', 300),
      weight: number(r.weight, 'Weight'),
    };
  });
  unique(
    alternatives.map((v) => v.id),
    'alternative IDs',
  );
  unique(
    criteria.map((v) => v.id),
    'criterion IDs',
  );
  const sources = array(d.sources, 'Sources', 0, 24).map<Source>((v) => {
    const r = record(v);
    const text = string(r.text, 'Source text', 8000);
    const kind = r.kind;
    if (
      kind !== 'benchmark' &&
      kind !== 'interview' &&
      kind !== 'estimate' &&
      kind !== 'document'
    )
      throw new Error('Unknown source kind.');
    if (typeof r.enabled !== 'boolean')
      throw new Error('Source enabled must be a boolean.');
    const assessments = array(r.assessments, 'Assessments', 0, 30).map((v) => {
      const a = record(v);
      const alternativeId = id(a.alternativeId);
      const criterionId = id(a.criterionId);
      if (
        !alternatives.some((v) => v.id === alternativeId) ||
        !criteria.some((v) => v.id === criterionId)
      )
        throw new Error(
          'Assessment references an unknown alternative or criterion.',
        );
      const low = number(a.low, 'Lower score');
      const high = number(a.high, 'Upper score');
      if (low > high) throw new Error('Lower score exceeds upper score.');
      const quote = string(a.quote, 'Quote', 1000);
      if (!text.includes(quote))
        throw new Error(
          'Assessment quote is not an exact excerpt of its source.',
        );
      return { alternativeId, criterionId, low, high, quote };
    });
    unique(
      assessments.map((a) => `${a.alternativeId}:${a.criterionId}`),
      'assessments within one source',
    );
    return {
      id: id(r.id),
      title: string(r.title, 'Source title', 120),
      kind,
      text,
      reliability: number(r.reliability, 'Reliability', 0, 1),
      enabled: r.enabled,
      assessments,
    };
  });
  unique(
    sources.map((v) => v.id),
    'source IDs',
  );
  unique(
    sources.map((v) => v.text.replace(/\s+/g, ' ').toLowerCase()),
    'source content',
  );
  const seed = number(d.seed, 'Seed', 1, 2147483647);
  if (!Number.isInteger(seed)) throw new Error('Seed must be an integer.');
  return {
    schemaVersion: 1,
    title: string(d.title, 'Title', 180),
    context: string(d.context, 'Context', 2000),
    alternatives,
    criteria,
    sources,
    seed,
  };
}

export function parseDeliberation(
  input: unknown,
  decision: Decision,
): Argument[] {
  const r = record(input);
  const args = array(r.arguments, 'Arguments', 3, 3).map<Argument>((v) => {
    const a = record(v);
    const perspective = a.perspective;
    if (
      perspective !== 'advocate' &&
      perspective !== 'skeptic' &&
      perspective !== 'auditor'
    )
      throw new Error('Unknown perspective.');
    const citations = array(a.citations, 'Citations', 1, 5).map((v) => {
      const c = record(v);
      const sourceId = id(c.sourceId);
      const quote = string(c.quote, 'Citation quote', 1000);
      const source = decision.sources.find(
        (s) => s.id === sourceId && s.enabled && s.reliability > 0,
      );
      if (!source || !source.text.includes(quote))
        throw new Error('AI returned an unverified citation.');
      return { sourceId, quote };
    });
    return {
      perspective,
      title: string(a.title, 'Argument title', 120),
      body: string(a.body, 'Argument', 2000),
      citations,
    };
  });
  unique(
    args.map((v) => v.perspective),
    'perspectives',
  );
  return args;
}

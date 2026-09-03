import { parseDecision, type Decision, type Source } from './domain';

const alternatives = [
  {
    id: 'managed',
    name: 'Managed service',
    description:
      'Ship quickly with a specialist provider. Trade some control for lower operational effort.',
  },
  {
    id: 'self',
    name: 'Self-hosted cluster',
    description:
      'Own the stack and tune every layer. Carry the staffing and reliability burden.',
  },
  {
    id: 'hybrid',
    name: 'Staged hybrid',
    description:
      'Start managed with a portable data layer. Prove the exit path before scaling.',
  },
];
const criteria = [
  {
    id: 'delivery',
    name: 'Time to value',
    description:
      'How quickly the team can ship a reliable first release. Higher is better.',
    weight: 30,
  },
  {
    id: 'cost',
    name: 'Cost efficiency',
    description:
      'Total ownership cost, including engineering time. Higher is better.',
    weight: 25,
  },
  {
    id: 'reliability',
    name: 'Operational fit',
    description:
      'Fit with current staffing and reliability needs. Higher is better.',
    weight: 30,
  },
  {
    id: 'control',
    name: 'Control & portability',
    description:
      'Ability to tune, export and change providers. Higher is better.',
    weight: 15,
  },
];
function source(
  id: string,
  title: string,
  kind: Source['kind'],
  text: string,
  reliability: number,
  values: [string, string, number, number, string][],
): Source {
  return {
    id,
    title,
    kind,
    text,
    reliability,
    enabled: true,
    assessments: values.map(
      ([alternativeId, criterionId, low, high, quote]) => ({
        alternativeId,
        criterionId,
        low,
        high,
        quote,
      }),
    ),
  };
}
export const infrastructure: Decision = parseDecision({
  schemaVersion: 1,
  title: 'Where should we run our next generation of search?',
  context:
    'A fictional six-person platform team needs to launch search in eight weeks. The team has one on-call rotation and expects traffic to triple. All source text and score ranges are synthetic teaching data; they are not vendor benchmarks.',
  alternatives,
  criteria,
  seed: 1729,
  sources: [
    source(
      'e01',
      'Delivery spike · week 02',
      'benchmark',
      'The managed prototype took 3 days. The self-hosted prototype took 12 days. The hybrid prototype took 6 days. These prototypes exclude production hardening.',
      0.85,
      [
        ['managed', 'delivery', 82, 96, 'The managed prototype took 3 days.'],
        ['self', 'delivery', 35, 55, 'The self-hosted prototype took 12 days.'],
        ['hybrid', 'delivery', 68, 85, 'The hybrid prototype took 6 days.'],
      ],
    ),
    source(
      'e02',
      'Ownership cost model · v3',
      'estimate',
      'Managed ownership cost is estimated at $48–70k per year. Self-hosting is estimated at $36–90k including engineering time. Hybrid ownership is estimated at $50–76k. Estimates are sensitive to traffic and staffing.',
      0.65,
      [
        [
          'managed',
          'cost',
          55,
          75,
          'Managed ownership cost is estimated at $48–70k per year.',
        ],
        [
          'self',
          'cost',
          45,
          88,
          'Self-hosting is estimated at $36–90k including engineering time.',
        ],
        ['hybrid', 'cost', 52, 73, 'Hybrid ownership is estimated at $50–76k.'],
      ],
    ),
    source(
      'e03',
      'On-call interviews · six engineers',
      'interview',
      'The team can operate the managed service within its current rotation. Nobody has operated the self-hosted engine at scale. The hybrid adds a small synchronization surface but keeps search operations managed.',
      0.8,
      [
        [
          'managed',
          'reliability',
          78,
          91,
          'The team can operate the managed service within its current rotation.',
        ],
        [
          'self',
          'reliability',
          25,
          50,
          'Nobody has operated the self-hosted engine at scale.',
        ],
        [
          'hybrid',
          'reliability',
          68,
          85,
          'The hybrid adds a small synchronization surface but keeps search operations managed.',
        ],
      ],
    ),
    source(
      'e04',
      'Portability experiment · export rehearsal',
      'benchmark',
      'The managed export required proprietary transformations. The self-hosted index and schema were fully accessible. The hybrid re-indexed from its portable event log in four hours.',
      0.9,
      [
        [
          'managed',
          'control',
          20,
          40,
          'The managed export required proprietary transformations.',
        ],
        [
          'self',
          'control',
          85,
          98,
          'The self-hosted index and schema were fully accessible.',
        ],
        [
          'hybrid',
          'control',
          76,
          92,
          'The hybrid re-indexed from its portable event log in four hours.',
        ],
      ],
    ),
    source(
      'e05',
      'Failure drill · synchronization gap',
      'benchmark',
      'The hybrid synchronization failed during a regional interruption and required manual replay. The drill covered one failure mode, not overall availability.',
      0.55,
      [
        [
          'hybrid',
          'reliability',
          42,
          59,
          'The hybrid synchronization failed during a regional interruption and required manual replay.',
        ],
      ],
    ),
  ],
});
export const launch: Decision = parseDecision({
  ...infrastructure,
  title: 'Should the next release be a big launch or a staged rollout?',
  context:
    'Synthetic product-release scenario. Compare a full launch, a private beta, and a staged rollout. Scores are illustrative decision inputs, not measured probabilities.',
  alternatives: [
    {
      id: 'managed',
      name: 'Full launch',
      description:
        'Reach every customer immediately. Accept a larger blast radius.',
    },
    {
      id: 'self',
      name: 'Private beta',
      description: 'Learn in a small cohort before wider release.',
    },
    {
      id: 'hybrid',
      name: 'Staged rollout',
      description: 'Expand exposure in steps with explicit rollback gates.',
    },
  ],
  criteria: [
    { ...criteria[0], name: 'Market reach', weight: 25 },
    { ...criteria[1], name: 'Learning efficiency', weight: 25 },
    { ...criteria[2], name: 'Failure containment', weight: 40 },
    { ...criteria[3], name: 'Reversibility', weight: 10 },
  ],
  sources: [
    source(
      'l01',
      'Release planning workshop',
      'document',
      'Full launch maximizes immediate reach but is difficult to reverse. Private beta limits exposure and accelerates learning. A staged rollout balances reach, learning and rollback control.',
      0.75,
      [
        [
          'managed',
          'delivery',
          88,
          98,
          'Full launch maximizes immediate reach but is difficult to reverse.',
        ],
        [
          'managed',
          'cost',
          45,
          65,
          'Full launch maximizes immediate reach but is difficult to reverse.',
        ],
        [
          'managed',
          'reliability',
          20,
          45,
          'Full launch maximizes immediate reach but is difficult to reverse.',
        ],
        [
          'managed',
          'control',
          25,
          40,
          'Full launch maximizes immediate reach but is difficult to reverse.',
        ],
        [
          'self',
          'delivery',
          20,
          40,
          'Private beta limits exposure and accelerates learning.',
        ],
        [
          'self',
          'cost',
          85,
          95,
          'Private beta limits exposure and accelerates learning.',
        ],
        [
          'self',
          'reliability',
          85,
          95,
          'Private beta limits exposure and accelerates learning.',
        ],
        [
          'self',
          'control',
          80,
          95,
          'Private beta limits exposure and accelerates learning.',
        ],
        [
          'hybrid',
          'delivery',
          60,
          80,
          'A staged rollout balances reach, learning and rollback control.',
        ],
        [
          'hybrid',
          'cost',
          75,
          90,
          'A staged rollout balances reach, learning and rollback control.',
        ],
        [
          'hybrid',
          'reliability',
          72,
          90,
          'A staged rollout balances reach, learning and rollback control.',
        ],
        [
          'hybrid',
          'control',
          85,
          95,
          'A staged rollout balances reach, learning and rollback control.',
        ],
      ],
    ),
  ],
});
export const presets = [
  {
    id: 'infrastructure',
    name: 'Infrastructure strategy',
    decision: infrastructure,
  },
  { id: 'launch', name: 'Release strategy', decision: launch },
];
export function blankDecision(): Decision {
  return {
    ...structuredClone(infrastructure),
    title: 'Your next consequential decision',
    context:
      'Describe the decision, constraints, stakeholders and time horizon. Add evidence and score ranges before interpreting the comparison.',
    sources: [],
  };
}

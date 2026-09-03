'use client';
import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { ablations, sensitivity } from '@/lib/engine';
import type { Decision } from '@/lib/domain';
const colors = ['#688b3d', '#9a7663', '#344f68', '#8e719c', '#bc8131'];
export function StressLab({
  decision,
  onChange,
}: {
  decision: Decision;
  onChange: (d: Decision) => void;
}) {
  const [criterionId, setCriterionId] = useState(decision.criteria[0].id);
  const selected = decision.criteria.some((c) => c.id === criterionId)
    ? criterionId
    : decision.criteria[0].id;
  const points = useMemo(
    () => sensitivity(decision, selected),
    [decision, selected],
  );
  const removed = useMemo(() => ablations(decision), [decision]);
  const config = Object.fromEntries(
    decision.alternatives.map((a, i) => [
      a.id,
      { label: a.name, color: colors[i] },
    ]),
  );
  return (
    <div className="stress-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">COUNTERFACTUAL / 01</p>
            <h3>Find the tipping point</h3>
          </div>
          <select
            aria-label="Sensitivity criterion"
            value={selected}
            onChange={(e) => setCriterionId(e.target.value)}
          >
            {decision.criteria.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className="small muted">
          Sweep this priority from 0% to 100%. Other priorities retain their
          relative proportions.
        </p>
        <ChartContainer config={config} className="sensitivity-chart">
          <LineChart
            accessibilityLayer
            data={points.map((p) => ({ weight: p.weight, ...p.scores }))}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="weight" unit="%" />
            <YAxis domain={[0, 100]} width={32} />
            <Tooltip />
            <Legend />
            {decision.alternatives.map((a, i) => (
              <Line
                key={a.id}
                type="linear"
                dataKey={a.id}
                name={a.name}
                stroke={colors[i]}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
        <details className="table-details">
          <summary>Read the chart as a table</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Priority</th>
                  {decision.alternatives.map((a) => (
                    <th key={a.id}>{a.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.weight}>
                    <th>{p.weight}%</th>
                    {decision.alternatives.map((a) => (
                      <td key={a.id}>{p.scores[a.id].toFixed(1)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="fineprint">
          This is sensitivity to analyst priorities, not a forecast of business
          outcomes.
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">COUNTERFACTUAL / 02</p>
            <h3>What if a source is wrong?</h3>
          </div>
        </div>
        <p className="small muted">
          Each experiment removes one source and recalculates the current
          leader’s score and recommendation status.
        </p>
        {removed.map((r) => (
          <div className="ablation" key={r.sourceId}>
            <div>
              <span className={`badge ${r.changesWinner ? 'amber' : ''}`}>
                {r.changesWinner ? 'DECISION CHANGES' : 'LEAD RETAINED'}
              </span>
              <h4>{r.title}</h4>
              <p>
                {r.status === 'insufficient'
                  ? 'Evidence becomes insufficient'
                  : (decision.alternatives.find((a) => a.id === r.winnerId)
                      ?.name ?? 'No clear leader')}{' '}
                · {r.scoreDelta >= 0 ? '+' : ''}
                {r.scoreDelta.toFixed(1)} score change
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                onChange({
                  ...decision,
                  sources: decision.sources.map((s) =>
                    s.id === r.sourceId ? { ...s, enabled: false } : s,
                  ),
                })
              }
            >
              Try it
            </Button>
          </div>
        ))}
        {!removed.length && (
          <div className="empty-state">
            <p>Add active evidence to run a removal experiment.</p>
          </div>
        )}
      </section>
    </div>
  );
}

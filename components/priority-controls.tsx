'use client';
import { Slider } from '@/components/ui/slider';
import type { Decision } from '@/lib/domain';
import { normalizedWeights } from '@/lib/engine';
export function PriorityControls({
  decision,
  onChange,
}: {
  decision: Decision;
  onChange: (decision: Decision) => void;
}) {
  const weights = normalizedWeights(decision);
  return (
    <section className="panel priority-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">YOUR VALUES, EXPLICIT</p>
          <h3>What matters most?</h3>
        </div>
        <span className="badge">NORMALIZED</span>
      </div>
      <p className="small muted">
        Adjust priorities. The recommendation updates immediately.
      </p>
      {decision.criteria.map((c) => (
        <div className="priority" key={c.id}>
          <div>
            <label id={`label-${c.id}`}>{c.name}</label>
            <output>
              {Math.round(weights[c.id] * 100)}
              <span>%</span>
            </output>
          </div>
          <Slider
            aria-labelledby={`label-${c.id}`}
            value={[c.weight]}
            onValueChange={(v) => {
              const weight = Array.isArray(v) ? v[0] : v;
              onChange({
                ...decision,
                criteria: decision.criteria.map((item) =>
                  item.id === c.id ? { ...item, weight } : item,
                ),
              });
            }}
          />
          <p>{c.description}</p>
        </div>
      ))}
    </section>
  );
}

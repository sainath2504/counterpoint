'use client';
import { useState } from 'react';
import { Plus, BookOpen, Eye, EyeOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parseDecision, type Decision, type Source } from '@/lib/domain';
export function EvidenceEditor({
  decision,
  onChange,
  focusId,
}: {
  decision: Decision;
  onChange: (decision: Decision) => void;
  focusId?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  function submit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => {
      const field = form.get(name);
      return typeof field === 'string' ? field : '';
    };
    const text = value('text');
    const source: Source = {
      id: `e_${crypto.randomUUID().slice(0, 8)}`,
      title: value('title'),
      text,
      kind: 'document',
      reliability: Number(form.get('reliability')),
      enabled: true,
      assessments: [
        {
          alternativeId: value('alternative'),
          criterionId: value('criterion'),
          low: Number(form.get('low')),
          high: Number(form.get('high')),
          quote: value('quote'),
        },
      ],
    };
    try {
      onChange(
        parseDecision({ ...decision, sources: [...decision.sources, source] }),
      );
      setAdding(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check the evidence fields.');
    }
  }
  const shown = decision.sources.filter((s) =>
    `${s.title} ${s.text}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SOURCE OF TRUTH</p>
          <h3>
            Evidence ledger{' '}
            <span className="muted">/ {decision.sources.length}</span>
          </h3>
        </div>
        <Button variant="outline" onClick={() => setAdding(!adding)}>
          <Plus size={15} /> Add evidence
        </Button>
      </div>
      <Input
        aria-label="Search evidence"
        placeholder="Search sources and excerpts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {adding && (
        <form className="evidence-form" onSubmit={submit}>
          <div className="panel-heading">
            <h3>Add an evidence-backed assessment</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close evidence form"
              onClick={() => setAdding(false)}
            >
              <X />
            </Button>
          </div>
          <p className="small muted">
            The score is your judgment. The quote must appear exactly in the
            source. Adding text does not automatically make it trustworthy.
          </p>
          <label htmlFor="evidence-title">
            Source title
            <Input id="evidence-title" name="title" required maxLength={120} />
          </label>
          <label htmlFor="evidence-text">
            Source text
            <Textarea
              id="evidence-text"
              name="text"
              required
              maxLength={8000}
              rows={4}
            />
          </label>
          <label htmlFor="evidence-quote">
            Exact supporting quote
            <Textarea
              id="evidence-quote"
              name="quote"
              required
              maxLength={1000}
            />
          </label>
          <div className="form-grid">
            <label htmlFor="evidence-alternative">
              Alternative
              <select id="evidence-alternative" name="alternative">
                {decision.alternatives.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="evidence-criterion">
              Criterion
              <select id="evidence-criterion" name="criterion">
                {decision.criteria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="evidence-low">
              Lower score
              <Input
                id="evidence-low"
                name="low"
                type="number"
                min={0}
                max={100}
                defaultValue={50}
                required
              />
            </label>
            <label htmlFor="evidence-high">
              Upper score
              <Input
                id="evidence-high"
                name="high"
                type="number"
                min={0}
                max={100}
                defaultValue={75}
                required
              />
            </label>
          </div>
          <label htmlFor="evidence-reliability">
            Reliability weight (0–1)
            <Input
              id="evidence-reliability"
              name="reliability"
              type="number"
              min={0}
              max={1}
              step={0.05}
              defaultValue={0.7}
              required
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">Add source and recalculate</Button>
        </form>
      )}
      <div className="source-list">
        {shown.map((s) => (
          <details
            open={focusId === s.id || undefined}
            key={s.id}
            id={`source-${s.id}`}
            className={`source ${s.enabled ? '' : 'excluded'}`}
          >
            <summary>
              <BookOpen size={17} />
              <span>
                <strong>{s.title}</strong>
                <small>
                  {s.id.toUpperCase()} · {s.kind} · {s.assessments.length}{' '}
                  assessments
                </small>
              </span>
              <span className="source-state">
                {s.enabled ? 'Included' : 'Excluded'}
              </span>
            </summary>
            <div className="source-body">
              <blockquote>{s.text}</blockquote>
              <div className="source-toolbar">
                <label htmlFor={`reliability-${s.id}`}>
                  Reliability
                  <Input
                    id={`reliability-${s.id}`}
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={s.reliability}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n >= 0 && n <= 1)
                        onChange({
                          ...decision,
                          sources: decision.sources.map((v) =>
                            v.id === s.id ? { ...v, reliability: n } : v,
                          ),
                        });
                    }}
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...decision,
                      sources: decision.sources.map((v) =>
                        v.id === s.id ? { ...v, enabled: !v.enabled } : v,
                      ),
                    })
                  }
                >
                  {s.enabled ? <EyeOff /> : <Eye />}
                  {s.enabled ? 'Exclude from analysis' : 'Include in analysis'}
                </Button>
              </div>
              {s.assessments.map((a) => (
                <div
                  className="assessment"
                  key={`${a.alternativeId}-${a.criterionId}`}
                >
                  <div>
                    <strong>
                      {
                        decision.alternatives.find(
                          (v) => v.id === a.alternativeId,
                        )?.name
                      }
                    </strong>
                    <span>
                      {
                        decision.criteria.find((v) => v.id === a.criterionId)
                          ?.name
                      }
                    </span>
                    <b>
                      {a.low}–{a.high}
                    </b>
                  </div>
                  <p>“{a.quote}”</p>
                </div>
              ))}
            </div>
          </details>
        ))}
        {!shown.length && (
          <div className="empty-state">
            <BookOpen />
            <h3>
              {decision.sources.length
                ? 'No matching sources'
                : 'No evidence yet'}
            </h3>
            <p>
              {decision.sources.length
                ? 'Try another search.'
                : 'Add a source and a cited assessment to begin. Missing evidence never counts as certainty.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

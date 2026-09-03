'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileText,
  FlaskConical,
  GitBranch,
  History,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Orbit,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PriorityControls } from './priority-controls';
import { EvidenceEditor } from './evidence-editor';
import { StressLab } from './stress-lab';
import { analyze, ENGINE_VERSION } from '@/lib/engine';
import { deterministicReview } from '@/lib/deliberation';
import { infrastructure, presets, blankDecision } from '@/lib/fixtures';
import {
  parseDecision,
  type Decision,
  type Deliberation,
  type Revision,
  type SavedDecision,
} from '@/lib/domain';
import {
  canonical,
  decisionMarkdown,
  digest,
  verifyHistory,
} from '@/lib/proof';
import { useDecisionTools } from './webmcp';

type Session = {
  authenticated: boolean;
  displayName: string;
  localDemo: boolean;
  liveAvailable: boolean;
  signInPath: string;
};
type View = 'decision' | 'stress' | 'review' | 'notebook' | 'brief' | 'method';
const navigation = [
  { id: 'decision', name: 'Decision workspace', icon: Layers3 },
  { id: 'stress', name: 'Stress lab', icon: FlaskConical },
  { id: 'review', name: 'Deliberation', icon: MessageSquare },
  { id: 'notebook', name: 'Decision notebook', icon: History },
  { id: 'brief', name: 'Edit the brief', icon: FileText },
  { id: 'method', name: 'The method', icon: GitBranch },
] satisfies { id: View; name: string; icon: typeof Layers3 }[];
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const result: unknown = await res.json();
    throw new Error(
      result &&
        typeof result === 'object' &&
        'error' in result &&
        typeof result.error === 'string'
        ? result.error
        : 'Request failed.',
    );
  }
  return res.json();
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DecisionStudio() {
  const [decision, setDecision] = useState<Decision>(() =>
    structuredClone(infrastructure),
  );
  const [view, setView] = useState<View>('decision');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [sourceFocus, setSourceFocus] = useState<string>();
  const [live, setLive] = useState<Deliberation | null>(null);
  const [saved, setSaved] = useState<SavedDecision[]>([]);
  const [history, setHistory] = useState<Revision[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentRevision, setCurrentRevision] = useState(0);
  const [baseline, setBaseline] = useState('');
  const [note, setNote] = useState('Initial decision brief');
  const [proofStatus, setProofStatus] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const mutation = useRef(0);
  const analysis = useMemo(() => analyze(decision), [decision]);
  const review = live ?? deterministicReview(decision, analysis);
  const dirty = canonical(decision) !== baseline;
  const lead = decision.alternatives.find((a) => a.id === analysis.winnerId);
  const active = decision.sources.filter(
    (s) => s.enabled && s.reliability > 0,
  ).length;
  useEffect(() => {
    void api<Session>('/api/session')
      .then(setSession)
      .catch(() =>
        setError(
          'Could not connect to saved workspaces. You can still explore and export the demo.',
        ),
      );
  }, []);
  useEffect(() => {
    if (!session?.authenticated) return;
    void api<{ decisions: SavedDecision[] }>('/api/decisions')
      .then((v) => setSaved(v.decisions))
      .catch((e) => setError(e.message));
  }, [session]);
  useEffect(() => {
    function protect(event: BeforeUnloadEvent) {
      if (currentId && dirty) {
        event.preventDefault();
      }
    }
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [currentId, dirty]);
  function change(next: Decision) {
    mutation.current++;
    setDecision(next);
    setLive(null);
    setNotice('');
  }
  function replace(next: Decision) {
    if (
      currentId &&
      dirty &&
      !window.confirm(
        'Replace your unsaved draft? Export it first if you want to keep it.',
      )
    )
      return;
    change(structuredClone(next));
    setCurrentId(null);
    setCurrentRevision(0);
    setHistory([]);
    setBaseline('');
    setView('decision');
    setProofStatus('');
    setError('');
  }
  function focusSource(id: string) {
    setSourceFocus(id);
    setView('decision');
    setTimeout(
      () =>
        document
          .getElementById(`source-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      50,
    );
  }
  useDecisionTools(decision, change);
  async function save() {
    setBusy('save');
    setError('');
    try {
      const id = currentId ?? crypto.randomUUID();
      const snapshot = parseDecision(decision);
      const result = await api<{ revision: Revision }>(`/api/decisions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot,
          expected: currentRevision,
          note,
          requestId: crypto.randomUUID(),
        }),
      });
      setCurrentId(id);
      setCurrentRevision(result.revision.revision);
      setBaseline(canonical(snapshot));
      setNote('Updated priorities and evidence');
      setNotice(
        `Revision ${result.revision.revision} saved. Its evidence and priorities can be replayed.`,
      );
      const [records, versions] = await Promise.all([
        api<{ decisions: SavedDecision[] }>('/api/decisions'),
        api<{ history: Revision[] }>(`/api/decisions/${id}`),
      ]);
      setSaved(records.decisions);
      setHistory(versions.history);
      setProofStatus('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy('');
    }
  }
  async function load(id: string) {
    if (
      currentId &&
      dirty &&
      !window.confirm('Load saved work and replace your unsaved draft?')
    )
      return;
    setBusy('load');
    setError('');
    try {
      const result = await api<{ history: Revision[] }>(`/api/decisions/${id}`);
      if (!(await verifyHistory(result.history)))
        throw new Error(
          'History verification failed. The current draft was not replaced.',
        );
      const latest = result.history.at(-1);
      if (!latest) throw new Error('No revisions found.');
      change(parseDecision(latest.snapshot));
      setCurrentId(id);
      setCurrentRevision(latest.revision);
      setBaseline(canonical(latest.snapshot));
      setHistory(result.history);
      setProofStatus('Verified: every revision and link matches.');
      setView('notebook');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    } finally {
      setBusy('');
    }
  }
  async function runLive() {
    const startedAtMutation = mutation.current;
    setBusy('review');
    setError('');
    try {
      const result = await api<Deliberation>('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      });
      if (mutation.current !== startedAtMutation) {
        setNotice(
          'The brief changed during review. The stale response was discarded.',
        );
        return;
      }
      setLive(result);
      setNotice(
        'Live review completed. Citations passed exact-excerpt checks; conclusions still require judgment.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setBusy('');
    }
  }
  async function exportJson() {
    const snapshot = parseDecision(decision);
    download(
      'counterpoint-decision.json',
      JSON.stringify(
        {
          format: 'counterpoint-export-v1',
          engineVersion: ENGINE_VERSION,
          snapshot,
          digest: await digest(snapshot),
        },
        null,
        2,
      ),
      'application/json',
    );
    setNotice('Decision exported with a content digest.');
  }
  async function importJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 300000) throw new Error('Import is limited to 300 KB.');
      const raw: unknown = JSON.parse(await file.text());
      let snapshot = raw;
      if (raw && typeof raw === 'object' && 'snapshot' in raw) {
        snapshot = raw.snapshot;
        if (!('digest' in raw) || (await digest(snapshot)) !== raw.digest)
          throw new Error(
            'Export digest mismatch. File was modified or is incomplete.',
          );
      }
      replace(parseDecision(snapshot));
      setNotice(
        'Validated decision imported. Save it to create a new notebook entry.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      event.target.value = '';
    }
  }
  const summary = `${analysis.status.toUpperCase()}: ${lead?.name ?? 'No recommendation'}. Midpoint lead ${analysis.margin.toFixed(1)} points. ${analysis.trials} deterministic stress trials; seed ${decision.seed}.`;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Orbit size={30} /> counterpoint<span>®</span>
        </Link>
        <div className="workspace-label">DECISION STUDIO</div>
        <nav aria-label="Primary">
          {navigation.map((item) => (
            <Button
              variant="ghost"
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
              key={item.id}
            >
              <item.icon size={18} />
              {item.name}
            </Button>
          ))}
        </nav>
        <div className="sidebar-project">
          <p className="workspace-label">EXPERIMENTS</p>
          {presets.map((p) => (
            <button key={p.id} onClick={() => replace(p.decision)}>
              <span className="tiny-dot" />
              {p.name}
              <ChevronRight size={13} />
            </button>
          ))}
          <button onClick={() => replace(blankDecision())}>
            <Plus size={14} />
            New decision
          </button>
        </div>
        <div className="sidebar-foot">
          <ShieldCheck size={18} />
          <p>
            Evidence before conviction.
            <br />
            <span>
              {session?.localDemo
                ? 'Local demo identity'
                : session?.authenticated
                  ? 'Private saved workspace'
                  : 'Guest exploration'}
            </span>
          </p>
        </div>
      </aside>
      <main id="workspace" className="main" tabIndex={-1}>
        <header className="topbar">
          <span>
            Workspace <span className="muted">/</span>{' '}
            {navigation.find((n) => n.id === view)?.name}
          </span>
          <div className="topbar-actions">
            <span className="badge">
              <span className="status-dot" />
              {live ? 'LIVE REVIEW' : 'DETERMINISTIC LAB'}
            </span>
            <span className="avatar" title={session?.displayName ?? 'Guest'}>
              {session?.authenticated ? 'SV' : 'G'}
            </span>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <Button
              key={item.id}
              variant={view === item.id ? 'secondary' : 'ghost'}
              onClick={() => setView(item.id)}
            >
              <item.icon size={15} />
              {item.name}
            </Button>
          ))}
        </nav>
        <section className="page-heading">
          <div>
            <p className="eyebrow">
              {currentId
                ? `NOTEBOOK / REVISION ${currentRevision}`
                : 'DECISION / WORKING DRAFT'}
            </p>
            <h1>
              Good decisions survive
              <br />
              <em>a little opposition.</em>
            </h1>
            <p className="lede">
              Inspect the evidence. Challenge the lead. Keep the proof.
            </p>
          </div>
          <div className="heading-actions">
            <Button variant="outline" onClick={() => void exportJson()}>
              <ArrowDownToLine />
              Export
            </Button>
            <Button
              disabled={!session?.authenticated || !!busy}
              onClick={() => void save()}
            >
              {busy === 'save' ? <LoaderCircle className="spin" /> : <Save />}
              Save decision
            </Button>
          </div>
        </section>
        {error ? (
          <div className="notice error" role="alert">
            <span>{error}</span>
            <Button
              aria-label="Dismiss message"
              variant="ghost"
              onClick={() => setError('')}
            >
              ×
            </Button>
          </div>
        ) : notice ? (
          <output className="notice">
            <span>{error || notice}</span>
            <Button
              aria-label="Dismiss message"
              variant="ghost"
              onClick={() => {
                setError('');
                setNotice('');
              }}
            >
              ×
            </Button>
          </output>
        ) : null}
        {!session?.authenticated && session && (
          <div className="guest-note">
            Explore without credentials.{' '}
            <a href={session.signInPath} target="_top">
              Sign in to save decisions
            </a>
            , or export a portable copy.
          </div>
        )}
        {view === 'decision' && (
          <>
            <div className="question-bar">
              <div className="question-top">
                <span className="eyebrow">THE QUESTION</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('brief')}
                >
                  Edit brief <ArrowUpRight size={13} />
                </Button>
              </div>
              <h2>{decision.title}</h2>
              <p>{decision.context}</p>
            </div>
            <section
              className="decision-grid"
              aria-label="Alternative comparison"
            >
              {decision.alternatives.map((a, i) => {
                const r = analysis.rankings.find(
                  (r) => r.alternativeId === a.id,
                )!;
                return (
                  <article
                    className={`option-card ${lead?.id === a.id ? 'recommended' : ''}`}
                    key={a.id}
                  >
                    <div className="option-top">
                      <span className="option-index">0{i + 1}</span>
                      {lead?.id === a.id ? (
                        <span className="badge green">
                          {analysis.status === 'supported'
                            ? 'SUPPORTED LEAD'
                            : 'CONDITIONAL LEAD'}
                        </span>
                      ) : (
                        <span className="badge">ALTERNATIVE</span>
                      )}
                    </div>
                    <h3>{a.name}</h3>
                    <p>{a.description}</p>
                    <div className="score-row">
                      <strong>{r.score.toFixed(1)}</strong>
                      <span>
                        / 100
                        <br />
                        weighted midpoint
                      </span>
                    </div>
                    <div
                      className="score-range"
                      aria-label={`Score interval ${r.low.toFixed(1)} to ${r.high.toFixed(1)}`}
                    >
                      <span
                        style={{
                          left: `${r.low}%`,
                          width: `${r.high - r.low}%`,
                        }}
                      />
                      <i style={{ left: `${r.score}%` }} />
                    </div>
                    <div className="range-labels">
                      <span>{r.low.toFixed(0)} low</span>
                      <span>{r.high.toFixed(0)} high</span>
                    </div>
                    <div className="option-bottom">
                      <span>
                        <b>{(r.wins * 100).toFixed(0)}%</b> stress-test win
                        share
                      </span>
                      <span>{Math.round(r.coverage * 100)}% covered</span>
                    </div>
                  </article>
                );
              })}
            </section>
            <p className="fineprint">
              {analysis.trials} seeded trials · Win share is not a probability
              of success · Score ranges are analyst judgments · {active} active
              sources
            </p>
            {analysis.warnings.map((w) => (
              <div className="warning" key={w}>
                <ShieldCheck size={16} />
                {w}
              </div>
            ))}
            <div className="workspace-grid">
              <div>
                <EvidenceEditor
                  decision={decision}
                  onChange={change}
                  focusId={sourceFocus}
                />
                <section className="panel matrix-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">TRACE EVERY SCORE</p>
                      <h3>The evidence matrix</h3>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Criterion</th>
                          {decision.alternatives.map((a) => (
                            <th key={a.id}>{a.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {decision.criteria.map((c) => (
                          <tr key={c.id}>
                            <th>{c.name}</th>
                            {decision.alternatives.map((a) => {
                              const cell = analysis.cells.find(
                                (v) =>
                                  v.alternativeId === a.id &&
                                  v.criterionId === c.id,
                              )!;
                              return (
                                <td key={a.id}>
                                  <strong>
                                    {cell.sourceIds.length
                                      ? `${cell.low.toFixed(0)}–${cell.high.toFixed(0)}`
                                      : 'Unknown'}
                                  </strong>
                                  {cell.contested && (
                                    <span className="contested">Disputed</span>
                                  )}
                                  <div className="citation-row">
                                    {cell.sourceIds.map((id) => (
                                      <button
                                        onClick={() => focusSource(id)}
                                        key={id}
                                      >
                                        {id.toUpperCase()}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              <div>
                <PriorityControls decision={decision} onChange={change} />
                <section className="insight-card">
                  <FlaskConical size={24} />
                  <h3>Can you change its mind?</h3>
                  <p>
                    Find the priority shift or missing source that overturns the
                    lead.
                  </p>
                  <Button onClick={() => setView('stress')} variant="outline">
                    Enter the stress lab <ArrowUpRight />
                  </Button>
                </section>
              </div>
            </div>
          </>
        )}
        {view === 'stress' && (
          <StressLab decision={decision} onChange={change} />
        )}
        {view === 'review' && (
          <>
            <section className="panel review-intro">
              <div>
                <p className="eyebrow">
                  THREE LENSES. NO ARTIFICIAL CONSENSUS.
                </p>
                <h2>Deliberation room</h2>
                <p className="small muted">
                  {live
                    ? 'One model call, three requested perspectives. These are not independent agents.'
                    : 'Deterministic templates derived from this decision. No model has been called.'}
                </p>
              </div>
              <Button
                disabled={
                  !session?.authenticated ||
                  !session.liveAvailable ||
                  !!busy ||
                  !active
                }
                onClick={() => void runLive()}
              >
                {busy === 'review' ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <MessageSquare />
                )}
                Request live AI review
              </Button>
            </section>
            {!session?.liveAvailable && (
              <p className="fineprint">
                Live review is optional and currently unconfigured. The server
                needs an API key and model; no key belongs in browser code.
              </p>
            )}
            {review.arguments.map((argument, i) => (
              <article className="panel argument" key={argument.perspective}>
                <div className={`role-mark role-${i}`}>
                  {['A', 'S', 'V'][i]}
                </div>
                <div>
                  <p className="eyebrow">
                    {argument.perspective} / {review.mode}
                  </p>
                  <h3>{argument.title}</h3>
                  <p>{argument.body}</p>
                  {argument.citations.map((c) => (
                    <button
                      className="argument-citation"
                      key={`${c.sourceId}-${c.quote}`}
                      onClick={() => focusSource(c.sourceId)}
                    >
                      <BookOpen size={14} />
                      <span>
                        <b>{c.sourceId.toUpperCase()}</b> “{c.quote}”
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </article>
            ))}
            {live && (
              <p className="fineprint">
                Model: {live.model} · {(live.durationMs / 1000).toFixed(1)}s ·{' '}
                {live.inputTokens ?? 'unreported'} input tokens /{' '}
                {live.outputTokens ?? 'unreported'} output tokens. Monetary cost
                is not estimated.
              </p>
            )}
          </>
        )}
        {view === 'notebook' && (
          <div className="notebook-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">PERSISTENT WORK</p>
                  <h3>Decision notebook</h3>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Refresh saved decisions"
                  disabled={!!busy || !session?.authenticated}
                  onClick={() =>
                    void api<{ decisions: SavedDecision[] }>('/api/decisions')
                      .then((v) => setSaved(v.decisions))
                      .catch((e) => setError(e.message))
                  }
                >
                  <RotateCcw />
                </Button>
              </div>
              {saved.map((s) => (
                <button
                  className={`saved-item ${s.id === currentId ? 'selected' : ''}`}
                  key={s.id}
                  onClick={() => void load(s.id)}
                  disabled={!!busy}
                >
                  <FileText />
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      Revision {s.revision} ·{' '}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!saved.length && (
                <div className="empty-state">
                  <History />
                  <h3>No saved decisions yet</h3>
                  <p>Save your working draft to create a replayable record.</p>
                </div>
              )}
              <div className="export-actions">
                <Button
                  variant="outline"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload />
                  Import JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      'counterpoint-brief.md',
                      decisionMarkdown(decision, summary),
                      'text/markdown',
                    )
                  }
                >
                  <ArrowDownToLine />
                  Export brief
                </Button>
                <input
                  hidden
                  type="file"
                  ref={importRef}
                  accept="application/json,.json"
                  onChange={(e) => void importJson(e)}
                />
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">APPEND-ONLY HISTORY</p>
                  <h3>Replay the decision</h3>
                </div>
                <span className="badge">
                  {dirty ? 'UNSAVED DRAFT' : 'SAVED'}
                </span>
              </div>
              <label className="field-label" htmlFor="revision-note">
                Revision note
                <Input
                  id="revision-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                />
              </label>
              <Button
                onClick={() => void save()}
                disabled={!session?.authenticated || !!busy || !note.trim()}
              >
                <Save />
                Save revision
              </Button>
              <p className="fineprint">
                Replaying a revision changes your draft. Save again to append a
                new revision; history is never rewritten.
              </p>
              {history.map((r) => (
                <div className="revision" key={r.revision}>
                  <span className="revision-number">{r.revision}</span>
                  <div>
                    <strong>{r.note}</strong>
                    <small>{new Date(r.createdAt).toLocaleString()}</small>
                    <code>{r.digest.slice(0, 20)}…</code>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      change(structuredClone(r.snapshot));
                      setNotice(
                        `Replaying revision ${r.revision}. Save to create a new revision from it.`,
                      );
                    }}
                  >
                    Replay
                  </Button>
                </div>
              ))}
              {history.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void verifyHistory(history).then((ok) =>
                        setProofStatus(
                          ok
                            ? 'Verified: every revision and link matches.'
                            : 'Verification failed.',
                        ),
                      )
                    }
                  >
                    <ShieldCheck />
                    Verify chain
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      download(
                        'counterpoint-history.json',
                        JSON.stringify(history, null, 2),
                        'application/json',
                      )
                    }
                  >
                    Export history
                  </Button>
                </>
              )}
              <output className="proof-status">{proofStatus}</output>
              <p className="fineprint">
                Hash links detect changes against retained checkpoints. They are
                not signatures and cannot prevent an administrator from
                rewriting the entire chain.
              </p>
            </section>
          </div>
        )}
        {view === 'brief' && (
          <section className="panel brief-editor">
            <p className="eyebrow">DEFINE THE DECISION BEFORE SCORING IT</p>
            <h2>The decision brief</h2>
            <label htmlFor="decision-title">
              Decision question
              <Input
                id="decision-title"
                value={decision.title}
                maxLength={180}
                onChange={(e) => change({ ...decision, title: e.target.value })}
              />
            </label>
            <label htmlFor="decision-context">
              Context and constraints
              <Textarea
                id="decision-context"
                value={decision.context}
                maxLength={2000}
                rows={4}
                onChange={(e) =>
                  change({ ...decision, context: e.target.value })
                }
              />
            </label>
            <Tabs defaultValue="alternatives">
              <TabsList>
                <TabsTrigger value="alternatives">Alternatives</TabsTrigger>
                <TabsTrigger value="criteria">Criteria</TabsTrigger>
              </TabsList>
              <TabsContent value="alternatives">
                {decision.alternatives.map((a) => (
                  <div className="brief-row" key={a.id}>
                    <label htmlFor={`alternative-name-${a.id}`}>
                      Alternative name
                      <Input
                        id={`alternative-name-${a.id}`}
                        value={a.name}
                        maxLength={80}
                        onChange={(e) =>
                          change({
                            ...decision,
                            alternatives: decision.alternatives.map((v) =>
                              v.id === a.id
                                ? { ...v, name: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label htmlFor={`alternative-description-${a.id}`}>
                      Trade-off
                      <Textarea
                        id={`alternative-description-${a.id}`}
                        value={a.description}
                        maxLength={500}
                        onChange={(e) =>
                          change({
                            ...decision,
                            alternatives: decision.alternatives.map((v) =>
                              v.id === a.id
                                ? { ...v, description: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="criteria">
                {decision.criteria.map((c) => (
                  <div className="brief-row" key={c.id}>
                    <label htmlFor={`criterion-name-${c.id}`}>
                      Criterion name
                      <Input
                        id={`criterion-name-${c.id}`}
                        value={c.name}
                        maxLength={60}
                        onChange={(e) =>
                          change({
                            ...decision,
                            criteria: decision.criteria.map((v) =>
                              v.id === c.id
                                ? { ...v, name: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label htmlFor={`criterion-description-${c.id}`}>
                      Definition (higher score must always mean better)
                      <Textarea
                        id={`criterion-description-${c.id}`}
                        value={c.description}
                        maxLength={300}
                        onChange={(e) =>
                          change({
                            ...decision,
                            criteria: decision.criteria.map((v) =>
                              v.id === c.id
                                ? { ...v, description: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
            <Button onClick={() => setView('decision')}>
              Return to comparison <ArrowUpRight />
            </Button>
          </section>
        )}
        {view === 'method' && (
          <section className="panel method-page">
            <p className="eyebrow">ENGINE {ENGINE_VERSION}</p>
            <h2>Make uncertainty inspectable.</h2>
            <p>
              Counterpoint separates observable source text, analyst judgments,
              decision-maker values, and model-written commentary. None can
              silently substitute for another.
            </p>
            <div className="method-flow">
              {[
                'Evidence + exact quote',
                'Score intervals + reliability',
                'Normalized priorities',
                '512 seeded stress trials',
                'Challenge + save + replay',
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
            <h3>What the numbers mean</h3>
            <p>
              Scores run from 0 to 100, with higher always better. Within a
              cell, source reliability weights determine the average interval.
              If intervals conflict, the stress test preserves their full range.
              Missing cells receive [0, 100], not a favorable zero. A shared
              uniform quantile per criterion models correlated outcomes across
              alternatives. This is an explicit simplification, not a calibrated
              real-world distribution.
            </p>
            <h3>When the engine abstains</h3>
            <p>
              If all priorities are zero, any alternative has less than 60%
              weighted evidence coverage, or leaders tie, no recommendation is
              issued. A supported lead additionally requires at least a
              three-point midpoint margin and 75% stress-test win share. These
              thresholds are product policy, not scientific constants.
            </p>
            <h3>Where AI belongs</h3>
            <p>
              Optional live AI writes an advocate, skeptic, and auditor
              perspective in one schema-constrained request. Exact citations are
              validated. The model cannot alter scores, overwrite history,
              approve a decision, or execute anything. An exact quote proves
              attribution, not entailment or truth.
            </p>
            <h3>What is real and what is synthetic</h3>
            <p>
              The two example briefs and their evidence are synthetic. Ranking,
              counterfactuals, exports, database writes, revision conflicts, and
              hash checks are real computations. Live model use is labeled
              separately and never silently replaced with a demo response.
            </p>
            <h3>What this release does not claim</h3>
            <p>
              No autonomous actions, independent-agent consensus, calibrated
              prediction, cryptographic signatures, or independently audited
              security. Hosted identity depends on the trusted Sites gateway.
              Local mode uses one explicitly labeled demo owner.
            </p>
          </section>
        )}
        <footer className="footer">
          <span>
            <Orbit size={14} /> Counterpoint · Decision intelligence, with
            receipts.
          </span>
          <span>Engine {ENGINE_VERSION} · No autonomous actions</span>
        </footer>
      </main>
    </div>
  );
}

'use client';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { analyze } from '@/lib/engine';
import { parseDecision, type Decision } from '@/lib/domain';
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
export function useDecisionTools(
  decision: Decision,
  onChange: (d: Decision) => void,
) {
  const current = useRef({ decision, onChange });
  useEffect(() => {
    current.current = { decision, onChange };
  }, [decision, onChange]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional capability; the visible workspace remains usable. */
      }
    };
    register({
      name: 'read_decision_analysis',
      description:
        'Read the current decision, priorities, active evidence IDs and deterministic comparison. No state is changed.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() {
        const d = current.current.decision;
        return {
          title: d.title,
          criteria: d.criteria,
          activeSourceIds: d.sources.filter((s) => s.enabled).map((s) => s.id),
          analysis: analyze(d),
        };
      },
    });
    register({
      name: 'set_decision_priorities',
      description:
        'Set criterion weights in the current working draft and recalculate the visible comparison. Does not save or approve the decision.',
      inputSchema: {
        type: 'object',
        properties: {
          weights: {
            type: 'object',
            additionalProperties: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
        required: ['weights'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !input ||
          typeof input !== 'object' ||
          !('weights' in input) ||
          !input.weights ||
          typeof input.weights !== 'object' ||
          Array.isArray(input.weights)
        )
          throw new Error('Provide a weights object.');
        const d = current.current.decision;
        const weights = Object.fromEntries(Object.entries(input.weights));
        if (
          Object.keys(weights).some(
            (id) => !d.criteria.some((c) => c.id === id),
          )
        )
          throw new Error('Unknown criterion.');
        const next = parseDecision({
          ...d,
          criteria: d.criteria.map((c) => ({
            ...c,
            weight: weights[c.id] ?? c.weight,
          })),
        });
        flushSync(() => current.current.onChange(next));
        return { criteria: next.criteria, analysis: analyze(next) };
      },
    });
    return () => lifecycle.abort();
  }, []);
}

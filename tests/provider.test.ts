import { describe, it, expect } from 'vitest';
import { liveReview } from '../lib/provider';
import { infrastructure } from '../lib/fixtures';
import { analyze } from '../lib/engine';
import { deterministicReview } from '../lib/deliberation';
const valid = deterministicReview(infrastructure, analyze(infrastructure));
function provider(text: string, status = 'completed'): typeof fetch {
  return async () =>
    Response.json({
      status,
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
      usage: { input_tokens: 123, output_tokens: 45 },
    });
}
describe('live provider contract (mocked, no paid requests)', () => {
  it('validates citations and records actual returned usage', async () => {
    const result = await liveReview(infrastructure, {
      apiKey: 'test-only',
      model: 'test-model',
      fetcher: provider(JSON.stringify(valid)),
    });
    expect(result.mode).toBe('live');
    expect(result.inputTokens).toBe(123);
    expect(result.arguments).toHaveLength(3);
  });
  it('rejects an invented source', async () => {
    const review = structuredClone(valid);
    review.arguments[0].citations[0].sourceId = 'invented';
    await expect(
      liveReview(infrastructure, {
        apiKey: 'test-only',
        model: 'test-model',
        fetcher: provider(JSON.stringify(review)),
      }),
    ).rejects.toThrow(/unverified/);
  });
  it('rejects an invented quote', async () => {
    const review = structuredClone(valid);
    review.arguments[0].citations[0].quote = 'False quote';
    await expect(
      liveReview(infrastructure, {
        apiKey: 'test-only',
        model: 'test-model',
        fetcher: provider(JSON.stringify(review)),
      }),
    ).rejects.toThrow(/unverified/);
  });
  it('does not substitute a demo for a provider failure', async () => {
    await expect(
      liveReview(infrastructure, {
        apiKey: 'test-only',
        model: 'test-model',
        fetcher: async () => new Response('', { status: 429 }),
      }),
    ).rejects.toThrow();
  });
  it('rejects incomplete responses', async () => {
    await expect(
      liveReview(infrastructure, {
        apiKey: 'test-only',
        model: 'test-model',
        fetcher: provider(JSON.stringify(valid), 'incomplete'),
      }),
    ).rejects.toThrow(/incomplete/);
  });
  it('rejects model refusals', async () => {
    await expect(
      liveReview(infrastructure, {
        apiKey: 'test-only',
        model: 'test-model',
        fetcher: async () =>
          Response.json({
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [{ type: 'refusal', refusal: 'No' }],
              },
            ],
          }),
      }),
    ).rejects.toThrow(/declined/);
  });
  it('rejects malformed JSON', async () => {
    await expect(
      liveReview(infrastructure, {
        apiKey: 'test-only',
        model: 'test-model',
        fetcher: provider('not json'),
      }),
    ).rejects.toThrow();
  });
  it('keeps authorization on the server request and disables provider storage', async () => {
    await liveReview(infrastructure, {
      apiKey: 'test-only',
      model: 'test-model',
      fetcher: async (url, options) => {
        expect(url).toBe('https://api.openai.com/v1/responses');
        if (typeof options?.body !== 'string')
          throw new Error('Expected a string body.');
        const body: unknown = JSON.parse(options.body);
        if (!body || typeof body !== 'object')
          throw new Error('Expected a JSON object.');
        expect('store' in body && body.store).toBe(false);
        expect('max_output_tokens' in body && body.max_output_tokens).toBe(
          4000,
        );
        expect('text' in body).toBe(true);
        return provider(JSON.stringify(valid))(url, options);
      },
    });
  });
});

import { env } from 'cloudflare:workers';
import { parseDecision } from '@/lib/domain';
import { liveReview } from '@/lib/provider';
import { RepositoryError } from '@/lib/repository';
import {
  errorResponse,
  identity,
  jsonBody,
  repository,
  response,
  sameOrigin,
} from '@/lib/server';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await identity(request);
    if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)
      throw new RepositoryError(
        503,
        'Live AI is not configured. The deterministic review remains available.',
      );
    let decision;
    try {
      decision = parseDecision(await jsonBody(request));
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw new RepositoryError(
        400,
        e instanceof Error ? e.message : 'Invalid decision.',
      );
    }
    if (
      !decision.sources.some(
        (s) => s.enabled && s.reliability > 0 && s.assessments.length,
      )
    )
      throw new RepositoryError(
        422,
        'Add active cited evidence before requesting a live review.',
      );
    if (!(await repository().reserveInference(owner)))
      throw new RepositoryError(
        429,
        'The hourly limit of 10 live reviews has been reached.',
      );
    try {
      return response(
        await liveReview(decision, {
          apiKey: env.OPENAI_API_KEY,
          model: env.OPENAI_MODEL,
        }),
      );
    } catch {
      throw new RepositoryError(
        502,
        'Live review failed validation, timed out, or was unavailable. No result has been substituted. You can still use the deterministic review.',
      );
    }
  } catch (e) {
    return errorResponse(e);
  }
}

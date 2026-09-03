import { parseDecision } from '@/lib/domain';
import { RepositoryError } from '@/lib/repository';
import {
  errorResponse,
  identity,
  jsonBody,
  object,
  pathId,
  repository,
  response,
  sameOrigin,
} from '@/lib/server';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const owner = await identity(request);
    const { id } = await context.params;
    return response({ history: await repository().history(owner, pathId(id)) });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const owner = await identity(request);
    const { id } = await context.params;
    const data = object(await jsonBody(request));
    if (
      typeof data.expected !== 'number' ||
      !Number.isInteger(data.expected) ||
      data.expected < 0 ||
      data.expected > 99
    )
      throw new RepositoryError(400, 'Invalid expected revision.');
    if (
      typeof data.note !== 'string' ||
      data.note.trim().length < 1 ||
      data.note.length > 300
    )
      throw new RepositoryError(
        400,
        'Add a revision note of 1–300 characters.',
      );
    if (
      typeof data.requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,64}$/.test(data.requestId)
    )
      throw new RepositoryError(400, 'Invalid request ID.');
    let snapshot;
    try {
      snapshot = parseDecision(data.snapshot);
    } catch (e) {
      throw new RepositoryError(
        400,
        e instanceof Error ? e.message : 'Invalid decision.',
      );
    }
    return response(
      {
        revision: await repository().save(
          owner,
          pathId(id),
          data.expected,
          snapshot,
          data.note.trim(),
          data.requestId,
        ),
      },
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

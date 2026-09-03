import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { DecisionRepository, RepositoryError } from './repository';
export function repository() {
  return new DecisionRepository(env.DB);
}
export function localDemo(request: Request) {
  return (
    env.COUNTERPOINT_LOCAL_DEMO === 'true' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  );
}
export async function identity(request: Request): Promise<string> {
  if (localDemo(request)) return 'local-demo-owner';
  const user = await getChatGPTUser();
  if (!user) throw new RepositoryError(401, 'Sign in to save or use live AI.');
  return user.userId;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new RepositoryError(403, 'A same-origin request is required.');
}
export async function jsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new RepositoryError(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new RepositoryError(400, 'Missing body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 300000) {
        await reader.cancel();
        throw new RepositoryError(413, 'The request exceeds 300 KB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    throw new RepositoryError(400, 'Malformed JSON.');
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RepositoryError(400, 'Expected a JSON object.');
  return Object.fromEntries(Object.entries(value));
}
export function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof RepositoryError)
    return response({ error: error.message }, error.status);
  return response(
    {
      error:
        'The operation could not be completed. Please retry. Your draft is unchanged.',
    },
    500,
  );
}
export function pathId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
    throw new RepositoryError(400, 'Invalid decision ID.');
  return id;
}

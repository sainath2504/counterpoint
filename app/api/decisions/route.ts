import { errorResponse, identity, repository, response } from '@/lib/server';
export async function GET(request: Request) {
  try {
    return response({
      decisions: await repository().list(await identity(request)),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

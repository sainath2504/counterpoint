import { repository, response } from '@/lib/server';
export async function GET() {
  try {
    await repository().list('__health__');
    return response({ status: 'ok', storage: 'ready', engine: '1.0.0' });
  } catch {
    return response({ status: 'unavailable', storage: 'not-ready' }, 503);
  }
}

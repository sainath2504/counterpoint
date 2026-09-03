import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '@/app/chatgpt-auth';
import { localDemo, response } from '@/lib/server';
export async function GET(request: Request) {
  const local = localDemo(request);
  const user = local ? null : await getChatGPTUser();
  return response({
    authenticated: local || !!user,
    displayName: local
      ? 'Local demo workspace'
      : (user?.displayName ?? 'Guest'),
    localDemo: local,
    liveAvailable: !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL,
    signInPath: chatGPTSignInPath('/'),
  });
}

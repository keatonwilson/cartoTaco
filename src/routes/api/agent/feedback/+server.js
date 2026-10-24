// POST /api/agent/feedback { run_id, score: 0|1, comment? } → 204
// Attaches a 👍/👎 to the concierge's LangSmith trace. A no-op without LangSmith.
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Client } from 'langsmith';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST({ request, locals }) {
  if (!locals.session) throw error(401, 'Sign in to send feedback');
  const body = await request.json().catch(() => null);
  if (!UUID.test(body?.run_id ?? '') || ![0, 1].includes(body.score)) throw error(400, 'Bad feedback');
  if (!env.LANGSMITH_API_KEY) return new Response(null, { status: 204 });

  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 1000) : undefined;
  await new Client({ apiKey: env.LANGSMITH_API_KEY })
    .createFeedback(body.run_id, 'user_score', { score: body.score, comment, sourceInfo: { user_id: locals.session.user.id } });
  return new Response(null, { status: 204 });
}

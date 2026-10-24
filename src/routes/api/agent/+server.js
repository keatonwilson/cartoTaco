// POST /api/agent { query, history } → { reply, actions, tier, run_id }
// Signed-in only. Each user gets a daily token budget (ai_usage, migration
// 040); over it, or when Anthropic refuses the call (e.g. the workspace spend
// limit), the concierge answers from the free rules tier only.
import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { runConcierge } from '$lib/server/agent/concierge.js';
import { DEFAULT_MODELS } from '$lib/server/agent/models.js';
import { getCatalog } from '$lib/server/catalog.js';

export const config = { maxDuration: 60 };

const DAILY_TOKENS = Number(env.AI_DAILY_TOKENS) || 200_000;
const MAX_QUERY = 500;
const MAX_TURNS = 12;
const MAX_TURN_CHARS = 2000;

// Today in Tucson, matching the ai_usage.day default
const tucsonDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });

/** Only what the concierge needs: no client-supplied system prompts, tools or roles. */
function parseBody(body) {
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > MAX_QUERY) return null;
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-MAX_TURNS)
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TURN_CHARS) }));
  return { query, history };
}

async function overBudget(supabase) {
  const { data, error: err } = await supabase
    .from('ai_usage').select('input_tokens, output_tokens').eq('day', tucsonDay()).maybeSingle();
  // ponytail: fail closed, except in dev, where .env points at a database that may predate migration 040
  if (err) return !dev;
  return (data?.input_tokens ?? 0) + (data?.output_tokens ?? 0) >= DAILY_TOKENS;
}

export async function POST({ request, locals }) {
  const { supabase, session } = locals;
  if (!session || !supabase) throw error(401, 'Sign in to use the concierge');

  const input = parseBody(await request.json().catch(() => null));
  if (!input) throw error(400, `Send a query of 1–${MAX_QUERY} characters`);

  const [catalog, favorites, over] = await Promise.all([
    getCatalog(supabase),
    supabase.from('user_favorites').select('est_id'),
    overBudget(supabase)
  ]);
  const user = { favoriteIds: new Set((favorites.data ?? []).map((f) => f.est_id)) };
  // Shared with runConcierge, so calls made before a failure still count
  const calls = [];
  const args = { ...input, catalog, user, calls, rulesOnly: over ? 'budget' : false };

  let result;
  try {
    result = await runConcierge(args);
  } catch (err) {
    console.error('concierge failed, answering from rules', err);
    result = await runConcierge({ ...args, calls: [], rulesOnly: 'unavailable' });
  }

  if (calls.length) {
    const sum = (k) => calls.reduce((n, c) => n + (c.usage?.[k] ?? 0), 0);
    const { error: err } = await supabase.rpc('record_ai_usage', {
      p_input_tokens: sum('input_tokens'),
      p_output_tokens: sum('output_tokens'),
      p_escalated: calls.some((c) => c.model === DEFAULT_MODELS.escalation),
      p_cost_usd: calls.reduce((n, c) => n + c.cost, 0)
    });
    if (err) console.error('record_ai_usage', err.message);
  }

  return json({ reply: result.reply, actions: result.actions, tier: result.tier, run_id: result.run_id ?? null });
}

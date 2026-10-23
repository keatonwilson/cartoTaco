// src/lib/server/agent/concierge.js
// The concierge: each query takes the cheapest tier that can answer it.
//
//   T0  rules (parseIntent / searchSpots), no model       $0
//   T1  Haiku router, one structured call → deterministic handler
//   T2  Haiku tool loop with the routed intent's tools, step cap 4
//   T3  Sonnet, the same loop, only when T2's answer fails validation
//
// ponytail: a plain function, not a LangGraph StateGraph — the tiers are a
// straight cascade with one branch each. Reach for LangGraph if it grows
// loops between tiers, interrupts (confirm cards) or checkpointed threads.
import { z } from 'zod';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { traceable, getCurrentRunTree } from 'langsmith/traceable';
import { parseIntent } from '../../intentRules.js';
import { searchSpots, normalize, editDistance } from '../../search.js';
import { DEFAULT_MODELS, chatModel, callCost } from './models.js';
import { PROMPT_VERSION, INTENTS, ROUTER_SYSTEM, AGENT_SYSTEM } from './prompt.js';
import { makeTools, FilterArgs, INTENT_TOOLS, toFilters } from './tools.js';

const MAX_STEPS = 4;
const CONFIDENT = 0.7;

export const RouterSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().describe('0 to 1'),
  needs_agent: z.boolean(),
  language: z.enum(['en', 'es']),
  spot_name: z.string().optional().describe('The spot named, if any'),
  filters: FilterArgs.optional()
});

const CANNED = {
  chitchat: {
    en: 'I can find taco spots, filter the map, and answer questions about Tucson spots. Try "spicy pork open now" or "is Tacos Apson open?"',
    es: 'Puedo buscar taquerías, filtrar el mapa y responder preguntas sobre lugares en Tucson. Prueba "puerco picante abierto ahora".'
  },
  // Not in chat until phase 4 gives them tools
  trail: {
    en: 'I can’t build trails in chat yet. Tap the Trail button on the map to pick stops and get a route.',
    es: 'Todavía no puedo armar rutas en el chat. Usa el botón Trail en el mapa para elegir paradas y ver la ruta.'
  },
  summit: {
    en: 'I can’t start a group vote from chat yet. Use Taco Summit to pick a few spots and share the vote with friends.',
    es: 'Todavía no puedo iniciar una votación desde el chat. Usa Taco Summit para elegir lugares y compartir la votación.'
  },
  off_topic: {
    en: 'I only know about tacos in Tucson, so I can’t help with that. Ask me about a spot or what you’re craving.',
    es: 'Solo sé de tacos en Tucson, así que no puedo ayudar con eso. Pregúntame por una taquería o un antojo.'
  }
};

// Shown with a spot so nobody walks to a closed or unchecked one
function spotNote(site) {
  if (site.isClosed) return ' It has permanently closed.';
  if (site.isPending) return ' It hasn’t been checked by CartoTaco yet, so details may be missing.';
  return '';
}

/** T0 name match: the query is (nearly) a spot's name and nothing else. */
function nameMatch(query, catalog) {
  const phrase = normalize(query);
  if (phrase.length < 4) return null;
  const isName = (site) => {
    const name = normalize(site.name);
    if (name.includes(phrase)) return true;
    const typos = phrase.length >= 7 ? 2 : 1;
    return editDistance(phrase, name.slice(0, phrase.length), typos) <= typos;
  };
  const hits = searchSpots(query, catalog, { limit: 2 }).filter((h) => isName(h.site));
  return hits.length === 1 ? hits[0].site : null;
}

/** "Pork · No trucks · Spice 7+" for a filter reply. */
function describeFilters(f) {
  const parts = [];
  if (f.proteins) parts.push(...Object.keys(f.proteins).filter((p) => f.proteins[p]));
  if (f.types) parts.push(Object.keys(f.types).filter((t) => f.types[t]).join(' or '));
  if (f.spiceLevel) parts.push(`spice ${f.spiceLevel.min}–${f.spiceLevel.max}`);
  if (f.openNow) parts.push('open now');
  if (f.showFavoritesOnly) parts.push('favorites');
  return parts.join(' · ');
}

const text = (ai) =>
  typeof ai.content === 'string'
    ? ai.content
    : ai.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

const citedIds = (reply) => [...reply.matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1]));

/**
 * One tool-calling loop (T2 or T3). Fails, with a reason, when it hits the
 * step cap, ends without a reply, or cites a spot no tool returned.
 */
async function agentLoop(model, modelId, toolNames, ctx, messages, calls) {
  const { tools, actions } = makeTools(ctx);
  const scoped = tools.filter((t) => toolNames.includes(t.name));
  const byName = Object.fromEntries(scoped.map((t) => [t.name, t]));
  const bound = model.bindTools(scoped);
  const seen = new Set();
  const msgs = [...messages];
  // Some models answer before their last tool call ("…I've opened its card"),
  // so the reply is the text of every turn, not just the final one
  const said = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const ai = await bound.invoke(msgs);
    calls.push({ model: modelId, usage: ai.usage_metadata, cost: callCost(modelId, ai.usage_metadata) });
    msgs.push(ai);
    if (text(ai).trim()) said.push(text(ai).trim());

    if (!ai.tool_calls?.length) {
      const reply = said.join('\n\n');
      if (!reply) return { ok: false, reason: 'empty_reply' };
      const unknown = citedIds(reply).filter((id) => !seen.has(id));
      if (unknown.length) return { ok: false, reason: `cited_unseen:${unknown.join(',')}` };
      return { ok: true, reply, actions };
    }

    for (const call of ai.tool_calls) {
      let out;
      try {
        if (!byName[call.name]) throw new Error(`Unknown tool ${call.name}`);
        out = await byName[call.name].invoke(call.args);
        for (const m of out.matchAll(/"est_id":(\d+)/g)) seen.add(Number(m[1]));
      } catch (err) {
        out = `Error: ${err.message}`;
      }
      msgs.push(new ToolMessage({ content: out, tool_call_id: call.id }));
    }
  }
  return { ok: false, reason: 'step_cap' };
}

/**
 * Answer one query.
 *
 * @param {object} p
 * @param {string} p.query
 * @param {Array<{role: 'user'|'assistant', content: string}>} [p.history]
 * @param {object[]} p.catalog - processSites() spots
 * @param {Date} [p.now]
 * @param {{ favoriteIds?: Set<number> }} [p.user]
 * @param {typeof DEFAULT_MODELS} [p.models]
 * @param {object} [p.llm] - chat model instances by tier, for tests
 * @param {boolean} [p.allowEscalation]
 * @returns {Promise<{ reply: string, actions: object[], tier: string, route: object|null,
 *   escalation_reason: string|null, calls: object[], cost: number }>}
 */
async function concierge({
  query, history = [], catalog, now = new Date(), user = {},
  models = DEFAULT_MODELS, llm = {}, allowEscalation = true
}) {
  const ctx = { catalog, now, user };
  const calls = [];
  const done = (tier, reply, actions = [], route = null, escalation_reason = null) => {
    const result = {
      reply, actions, tier, route, escalation_reason, calls,
      cost: calls.reduce((sum, c) => sum + c.cost, 0)
    };
    const run = getCurrentRunTree(true);
    if (run?.extra) {
      run.extra.metadata = {
        ...run.extra.metadata, tier, prompt_version: PROMPT_VERSION,
        route_intent: route?.intent, router_confidence: route?.confidence, escalation_reason
      };
    }
    return result;
  };

  // T0: rules. A query the filter parser fully covers, or a bare spot name.
  const intent = parseIntent(query);
  const t0Filters = intent.covered && !intent.extras.near && !intent.extras.handmadeTortillas &&
    !(intent.filters.showFavoritesOnly && !user.favoriteIds);
  if (t0Filters) {
    const { fns, actions } = makeTools(ctx);
    const args = {
      proteins: Object.keys(intent.filters.proteins || {}),
      types: intent.filters.types && Object.keys(intent.filters.types).filter((t) => intent.filters.types[t]),
      spice_min: intent.filters.spiceLevel?.min,
      spice_max: intent.filters.spiceLevel?.max,
      open_now: intent.filters.openNow,
      favorites_only: intent.filters.showFavoritesOnly
    };
    const { matching } = fns.apply_filters(args);
    return done('t0', `Filtered the map to ${intent.matched.join(' · ')}: ${matching} spot${matching === 1 ? '' : 's'}.`, actions);
  }
  const named = nameMatch(query, catalog);
  if (named) {
    const { fns, actions } = makeTools(ctx);
    fns.show_spot({ est_id: named.est_id });
    return done('t0', `Here’s ${named.name} [#${named.est_id}].${spotNote(named)}`, actions);
  }

  // T1: one router call, then a deterministic handler when the route is simple
  const turns = history.slice(-6).map((m) =>
    m.role === 'assistant' ? new AIMessage(m.content) : new HumanMessage(m.content));
  const router = (llm.router ?? chatModel(models.router, { maxTokens: 400 }))
    .withStructuredOutput(RouterSchema, { name: 'route', method: 'jsonSchema', includeRaw: true });
  const { raw, parsed: route } = await router.invoke([
    new SystemMessage(ROUTER_SYSTEM), ...turns, new HumanMessage(query)
  ]);
  calls.push({ model: models.router, usage: raw.usage_metadata, cost: callCost(models.router, raw.usage_metadata) });

  const simple = route.confidence >= CONFIDENT && !route.needs_agent;
  if (CANNED[route.intent] && route.confidence >= CONFIDENT) {
    return done('t1', CANNED[route.intent][route.language], [], route);
  }
  if (simple && route.intent === 'find_spot' && route.spot_name) {
    const hit = searchSpots(route.spot_name, catalog, { limit: 1 })[0];
    if (hit) {
      const { fns, actions } = makeTools(ctx);
      fns.show_spot({ est_id: hit.site.est_id });
      return done('t1', `Here’s ${hit.site.name} [#${hit.site.est_id}].${spotNote(hit.site)}`, actions, route);
    }
  }
  if (simple && route.intent === 'filter' && route.filters && Object.keys(toFilters(route.filters)).length &&
      !(route.filters.favorites_only && !user.favoriteIds)) {
    const { fns, actions } = makeTools(ctx);
    const { matching } = fns.apply_filters(route.filters);
    return done('t1', `Filtered the map to ${describeFilters(toFilters(route.filters))}: ${matching} spot${matching === 1 ? '' : 's'}.`, actions, route);
  }

  // T2: cheap agent with only the routed intent's tools
  const toolNames = INTENT_TOOLS[route.intent] || INTENT_TOOLS.default;
  const messages = [
    new SystemMessage({ content: [{ type: 'text', text: AGENT_SYSTEM, cache_control: { type: 'ephemeral' } }] }),
    ...turns,
    new HumanMessage(query)
  ];
  const t2 = await agentLoop(llm.agent ?? chatModel(models.agent), models.agent, toolNames, ctx, messages, calls);
  if (t2.ok) return done('t2', t2.reply, t2.actions, route);
  if (!allowEscalation) {
    return done('t2', 'Sorry, I couldn’t work that out. Try asking another way, or use the search box.', [], route, t2.reason);
  }

  // T3: escalate, fresh, to the stronger model with every tool
  const t3 = await agentLoop(
    llm.escalation ?? chatModel(models.escalation, { maxTokens: 4096 }),
    models.escalation, INTENT_TOOLS.default, ctx, messages, calls
  );
  if (t3.ok) return done('t3', t3.reply, t3.actions, route, t2.reason);
  return done('t3', 'Sorry, I couldn’t work that out. Try asking another way, or use the search box.', [], route, `${t2.reason};${t3.reason}`);
}

export const runConcierge = traceable(concierge, {
  name: 'concierge',
  metadata: { prompt_version: PROMPT_VERSION, env: process.env.VERCEL_ENV || 'dev', git_sha: process.env.VERCEL_GIT_COMMIT_SHA }
});

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
// A trail may need search → plan → (warned: too long) → nearer search → plan → reply
const TRAIL_STEPS = 6;
// Text written alongside these is dropped: beside a lookup it's narration, and
// beside a trail, compare or summit it predates the tool's answer (plan_trail
// reorders the stops)
const QUIET_TOOLS = new Set(['search_spots', 'get_spot', 'city_stats', 'recommend_for_me', 'describe_dish',
  'plan_trail', 'compare_spots', 'start_summit']);

// ponytail: regexes for the narration and markdown Haiku writes despite the
// prompt ("Let me show you these on the map:", **bold**). A leading or trailing
// sentence only; move to a structured reply if the patterns multiply.
// A sentence citing a spot is the answer, however it starts, so it's kept.
const NARRATION = String.raw`(?:now,? )?(?:let me|i'll|i will) (?:show|check|look|pull|get|open|filter|put|update|build|plan|search)\b(?![^.!?:\n]*\[#\d+\])[^.!?:\n]*[.!?:]?`;
const LEADING_NARRATION = new RegExp(String.raw`^\s*${NARRATION}\s*`, 'i');
const TRAILING_NARRATION = new RegExp(String.raw`(^|[.!?\n])\s*${NARRATION}\s*$`, 'i');

/** Strip narration and markdown emphasis from one turn's text. */
export function cleanReply(words) {
  return words
    .replace(LEADING_NARRATION, '')
    .replace(TRAILING_NARRATION, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
}
const CONFIDENT = 0.7;

export const RouterSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().describe('0 to 1'),
  needs_agent: z.boolean(),
  language: z.enum(['en', 'es']),
  spot_name: z.string().optional().describe('The spot named, if any'),
  dish_name: z.string().optional().describe('The food asked about, if any'),
  filters: FilterArgs.optional()
});

const RULES_ONLY = {
  budget: 'The concierge has used up its budget for now. Spot names and filters like “spicy pork open now” still work.',
  unavailable: 'The concierge isn’t available right now. Spot names and filters like “spicy pork open now” still work; try again in a minute.'
};

const CANNED = {
  chitchat: {
    en: 'I can find taco spots, filter the map, answer questions about Tucson spots, explain what a dish is, plan a trail, compare spots, set up a Taco Summit vote, and suggest spots from your favorites. Try "spicy pork open now" or "a walking birria trail".',
    es: 'Puedo buscar taquerías, filtrar el mapa, responder preguntas, armar una ruta, comparar lugares, iniciar una votación Taco Summit y recomendar según tus favoritos. Prueba "puerco picante abierto ahora".'
  },
  off_topic: {
    en: 'I only know about tacos in Tucson, so I can’t help with that. Ask me about a spot or what you’re craving.',
    es: 'Solo sé de tacos en Tucson, así que no puedo ayudar con eso. Pregúntame por una taquería o un antojo.'
  }
};

/** Who's asking, so the agent knows whether favorites and personal picks can work. */
const userNote = (user) => !user.favoriteIds
  ? 'The user is not signed in: no favorites or personal picks.'
  : `The user is signed in with ${user.favoriteIds.size} favorite spot${user.favoriteIds.size === 1 ? '' : 's'}.`;

// Shown with a spot so nobody walks to a closed or unchecked one
function spotNote(site) {
  if (site.isClosed) return ' It has permanently closed.';
  if (site.isPending) return ' It hasn’t been checked by CartoTaco yet, so details may be missing.';
  return '';
}

/** Is `text` (nearly) this spot's name, rather than words found elsewhere on it? */
function isName(text, site) {
  const phrase = normalize(text);
  const name = normalize(site.name);
  if (name.includes(phrase)) return true;
  const typos = phrase.length >= 7 ? 2 : 1;
  return editDistance(phrase, name.slice(0, phrase.length), typos) <= typos;
}

/** T0 name match: the query is (nearly) a spot's name and nothing else. */
function nameMatch(query, catalog) {
  if (normalize(query).length < 4) return null;
  const hits = searchSpots(query, catalog, { limit: 2, complete: true }).filter((h) => isName(query, h.site));
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

// A food looked up twice (seeded, then again by the model) is credited once
const mergeActions = (...lists) => lists.flat().filter((a, i, all) =>
  a.type !== 'sources' || all.findIndex((b) => b.type === 'sources' && b.name === a.name) === i);

const citedIds = (reply) => [...reply.matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1]));

/**
 * One tool-calling loop (T2 or T3). Fails, with a reason, when it hits the
 * step cap, ends without a reply, or cites a spot no tool returned.
 */
async function agentLoop(model, modelId, toolNames, ctx, messages, calls, maxSteps = MAX_STEPS) {
  const { tools, actions } = makeTools(ctx);
  const scoped = tools.filter((t) => toolNames.includes(t.name));
  const byName = Object.fromEntries(scoped.map((t) => [t.name, t]));
  const bound = model.bindTools(scoped);
  // Spots cited in earlier assistant turns count as seen, so a follow-up can
  // mention them again without a fresh lookup. History comes from the client
  // in phase 3, so only ids that exist in the catalog are trusted.
  const known = new Set(ctx.catalog.map((s) => s.est_id));
  const seen = new Set(messages
    .filter((m) => m instanceof AIMessage && typeof m.content === 'string')
    .flatMap((m) => citedIds(m.content))
    .filter((id) => known.has(id)));
  // …as do spots in a seeded lookup (see agentTiers)
  for (const m of messages) {
    if (m instanceof ToolMessage) for (const id of m.content.matchAll(/"est_id":(\d+)/g)) seen.add(Number(id[1]));
  }
  const msgs = [...messages];
  // Some models answer before their last tool call ("…I've opened its card"),
  // so the reply is the text of every turn, except text alongside a lookup,
  // which is narration ("Let me check their salsas…")
  const said = [];

  for (let step = 0; step < maxSteps; step++) {
    const ai = await bound.invoke(msgs);
    calls.push({ model: modelId, usage: ai.usage_metadata, cost: callCost(modelId, ai.usage_metadata) });
    msgs.push(ai);
    const words = cleanReply(text(ai));
    if (words && !ai.tool_calls?.some((c) => QUIET_TOOLS.has(c.name))) said.push(words);

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
 * @param {{ version: string|null, cards: object[] }} [p.kb] - cocina's published cards (describe_dish)
 * @param {typeof DEFAULT_MODELS} [p.models]
 * @param {object} [p.llm] - chat model instances by tier, for tests
 * @param {boolean} [p.allowEscalation]
 * @param {false|'budget'|'unavailable'} [p.rulesOnly] - answer from T0 only, and say why on a miss
 * @param {object[]} [p.calls] - collects each model call; pass one in to read usage even if this throws
 * @returns {Promise<{ reply: string, actions: object[], tier: string, route: object|null,
 *   escalation_reason: string|null, calls: object[], cost: number, kb_lookups: object[], run_id?: string }>}
 */
async function concierge({
  query, history = [], catalog, now = new Date(), user = {}, kb = { version: null, cards: [] },
  models = DEFAULT_MODELS, llm = {}, allowEscalation = true, rulesOnly = false, calls = []
}) {
  // Every describe_dish across tiers; /api/agent reports the misses for cocina's gap filler
  const ctx = { catalog, now, user, kb, lookups: [] };
  const done = (tier, reply, actions = [], route = null, escalation_reason = null) => {
    const run = getCurrentRunTree(true);
    const result = {
      reply, actions, tier, route, escalation_reason, calls,
      cost: calls.reduce((sum, c) => sum + c.cost, 0),
      kb_lookups: ctx.lookups,
      run_id: run?.id
    };
    if (run?.extra) {
      run.extra.metadata = {
        ...run.extra.metadata, tier, prompt_version: PROMPT_VERSION,
        route_intent: route?.intent, router_confidence: route?.confidence, escalation_reason,
        kb_version: kb.version
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

  if (rulesOnly) {
    return done('t0', RULES_ONLY[rulesOnly] ?? RULES_ONLY.budget, [], null, rulesOnly === true ? 'budget' : rulesOnly);
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

  // An unparseable route (cut off, refused, off-schema) comes back null: skip
  // the handlers and let the agent work it out with every tool
  if (!route) return agentTiers(null, 'router_parse_failed');

  const simple = route.confidence >= CONFIDENT && !route.needs_agent;
  if (CANNED[route.intent] && route.confidence >= CONFIDENT) {
    return done('t1', CANNED[route.intent][route.language], [], route);
  }
  if (simple && route.intent === 'find_spot' && route.spot_name) {
    // Only a hit on the name: "take me to Taco Bell" shouldn't open a spot
    // whose description happens to mention tacos
    const hit = searchSpots(route.spot_name, catalog, { limit: 3, complete: true }).find((h) => isName(route.spot_name, h.site));
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

  return agentTiers(route, null);

  /**
   * When the router named a food or a spot, run its lookup up front and hand
   * the agent the result as an earlier tool call. Haiku otherwise sometimes
   * answered "not on CartoTaco" without searching (or a dish from memory), and
   * it saves a step. Returns the lookup's actions too (describe_dish's sources).
   */
  function seed(route, toolNames) {
    const [name, args] = route?.intent === 'dish_info' && route.dish_name && toolNames.includes('describe_dish')
      ? ['describe_dish', { name: route.dish_name }]
      : route?.spot_name && toolNames.includes('search_spots')
        ? ['search_spots', { query: route.spot_name, limit: 3 }]
        : [];
    if (!name) return { messages: [], actions: [] };
    const { fns, actions } = makeTools(ctx);
    const out = fns[name](args);
    const id = `seeded_${name}`;
    return {
      messages: [
        new AIMessage({ content: '', tool_calls: [{ id, name, args, type: 'tool_call' }] }),
        new ToolMessage({ content: JSON.stringify(out), tool_call_id: id })
      ],
      actions
    };
  }

  /** T2, then T3 if T2's answer fails validation. `note` explains a skipped router. */
  async function agentTiers(route, note) {
    // T2: cheap agent with only the routed intent's tools
    const toolNames = (route && INTENT_TOOLS[route.intent]) || INTENT_TOOLS.default;
    const seeded = seed(route, toolNames);
    const messages = [
      new SystemMessage({ content: [
        { type: 'text', text: AGENT_SYSTEM, cache_control: { type: 'ephemeral' } },
        // After the cache breakpoint, so it doesn't split the cache per user
        { type: 'text', text: userNote(user) }
      ] }),
      ...turns,
      new HumanMessage(query),
      ...seeded.messages
    ];
    // Only trail requests get the longer loop (room to re-plan a long trail)
    const steps = route?.intent === 'trail' ? TRAIL_STEPS : MAX_STEPS;
    const t2 = await agentLoop(llm.agent ?? chatModel(models.agent), models.agent, toolNames, ctx, messages, calls, steps);
    const why = (reason) => [note, reason].filter(Boolean).join(';') || null;
    if (t2.ok) return done('t2', t2.reply, mergeActions(seeded.actions, t2.actions), route, why());
    if (!allowEscalation) {
      return done('t2', 'Sorry, I couldn’t work that out. Try asking another way, or use the search box.', [], route, why(t2.reason));
    }

    // T3: escalate, fresh (with the same seeded search), to the stronger model with every tool
    const t3 = await agentLoop(
      llm.escalation ?? chatModel(models.escalation, { maxTokens: 4096 }),
      models.escalation, INTENT_TOOLS.default, ctx, messages, calls, steps
    );
    if (t3.ok) return done('t3', t3.reply, mergeActions(seeded.actions, t3.actions), route, why(t2.reason));
    return done('t3', 'Sorry, I couldn’t work that out. Try asking another way, or use the search box.', [], route, why(`${t2.reason};${t3.reason}`));
  }
}

export const runConcierge = traceable(concierge, {
  name: 'concierge',
  metadata: { prompt_version: PROMPT_VERSION, env: process.env.VERCEL_ENV || 'dev', git_sha: process.env.VERCEL_GIT_COMMIT_SHA }
});

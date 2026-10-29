// src/lib/server/agent/tools.js
// The concierge's tools: plain functions over the catalog (processSites()
// spots), shared by the router's deterministic handlers and the agent loop.
// Read tools return compact JSON; action tools validate est_ids and record an
// action for the client to apply (applyActions in src/lib/agentStore.js).
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchSpots, searchFields, normalize } from '../../search.js';
import { applyIntentFilters } from '../../intentRules.js';
import { matchesFilters, defaultFilterConfig, computeSummaryStats, hasValidCoordinates } from '../../siteModel.js';
import { recommendFor } from '../../recommend.js';
import { getOpenStatus, todayHours } from '../../hours.js';
import { findEntry, describeEntry, credits } from '../../kb.js';

const PROTEINS = ['chicken', 'beef', 'pork', 'fish', 'veg'];
const TYPES = ['Brick and Mortar', 'Stand', 'Truck'];
// menu.flour_corn says which kinds are offered, not who makes them
const TORTILLAS = { both: 'corn and flour', corn: 'corn', flour: 'flour' };
const TRAIL_MODES = ['walking', 'cycling', 'driving'];
const MAX_TRAIL = 8;
// Where a dish's name counts as "this spot serves it" (not its name, a street or a
// region), strongest first: a specialty beats a passing mention in the description
const SERVES_FIELDS = ['specialty', 'style', 'salsa', 'menu', 'description'];
// Straight-line km past which a trail gets a warning to re-plan
const LONG_TRAIL_KM = { walking: 5, cycling: 20 };
const MAX_COMPARE = 3;
const SUMMIT_SPOTS = [2, 6];

/** Straight-line km between two placeable spots (haversine). */
function km(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Visit order for a trail: start at the first stop, then always the nearest
 * one left. ponytail: greedy nearest-neighbour, fine for ≤8 stops; the tray
 * lets people reorder.
 */
function nearestOrder(stops) {
  const left = stops.slice(1);
  const order = [stops[0]];
  while (left.length) {
    const last = order[order.length - 1];
    left.sort((a, b) => km(last, a) - km(last, b));
    order.push(left.shift());
  }
  return order;
}

/** A bad argument the model can fix (unknown est_id and the like). */
export class ToolError extends Error {}

// Filter arguments, shared by search_spots, apply_filters and the router slots.
// No min/max on the numbers: structured outputs rejects them, so toFilters clamps.
export const FilterArgs = z.object({
  proteins: z.array(z.enum(PROTEINS)).optional().describe('Spots serving any of these'),
  types: z.array(z.enum(TYPES)).optional().describe('Only these kinds of spot'),
  spice_min: z.number().optional().describe('0-10'),
  spice_max: z.number().optional().describe('0-10'),
  open_now: z.boolean().optional(),
  favorites_only: z.boolean().optional()
});

/** Filter args → the partial filterConfig shape parseIntent() produces. */
export function toFilters(args = {}) {
  const filters = {};
  if (args.proteins?.length) filters.proteins = Object.fromEntries(args.proteins.map((p) => [p, true]));
  if (args.types?.length) filters.types = Object.fromEntries(TYPES.map((t) => [t, args.types.includes(t)]));
  if (args.spice_min != null || args.spice_max != null) {
    const clamp = (n, d) => Math.min(10, Math.max(0, n ?? d));
    filters.spiceLevel = { min: clamp(args.spice_min, 0), max: clamp(args.spice_max, 10) };
  }
  if (args.open_now) filters.openNow = true;
  if (args.favorites_only) filters.showFavoritesOnly = true;
  if (args.dish?.trim()) filters.searchText = args.dish.trim();
  return filters;
}

// The UI's "Closes soon · 8 PM" reads to Haiku as "opens soon"; say it's open
const status = (site, now) => getOpenStatus(site.rawData.hours, now).label.replace('Closes soon ·', 'Open now, closes soon at');

/** The fields a model needs to talk about a spot, and no more. */
function brief(site, now) {
  const row = { est_id: site.est_id, name: site.name, type: site.type };
  if (site.isClosed) return { ...row, closed: true };
  if (site.isPending) return { ...row, pending: true, status: status(site, now) };
  return {
    ...row,
    heat: site.heatOverall,
    salsas: site.salsaCount,
    status: status(site, now)
  };
}

/**
 * Build the tool set for one request.
 *
 * @param {{ catalog: object[], now?: Date, user?: { favoriteIds?: Set<number> },
 *   kb?: { version: string|null, cards: object[] } }} ctx - kb: cocina's published cards
 * @returns {{ fns: object, tools: object[], actions: object[] }}
 */
export function makeTools({ catalog, now = new Date(), user = {}, kb = { version: null, cards: [] } }) {
  const byId = new Map(catalog.map((s) => [s.est_id, s]));
  const favIds = user.favoriteIds || new Set();
  const actions = [];

  const spot = (estId) => {
    const site = byId.get(Number(estId));
    if (!site) throw new ToolError(`No spot with est_id ${estId}. Use an est_id from search_spots.`);
    return site;
  };

  const matching = (filters) => {
    const cfg = applyIntentFilters(defaultFilterConfig(), filters);
    return catalog.filter((s) => matchesFilters(s, cfg, favIds, now));
  };

  /** min–max distinct spots by est_id, none closed (nor pending, unless allowed). `what` names them in errors. */
  const pickSpots = (estIds = [], [min, max], what, { pending = false } = {}) => {
    const sites = [...new Set(estIds.map(Number))].map(spot);
    const closed = sites.filter((s) => s.isClosed);
    if (closed.length) throw new ToolError(`${closed.map((s) => s.name).join(', ')} has permanently closed; leave it out.`);
    const unchecked = pending ? [] : sites.filter((s) => s.isPending);
    if (unchecked.length) throw new ToolError(`${unchecked.map((s) => s.name).join(', ')} hasn't been checked yet, so it can't be in a ${what}; leave it out.`);
    if (sites.length < min || sites.length > max) throw new ToolError(`A ${what} needs ${min} to ${max} different spots; got ${sites.length}.`);
    return sites;
  };

  /**
   * Spots whose specialties, protein styles, salsas, menu or description name one of
   * these as whole words (or their plural). Not fuzzy: "gringa" mustn't find "gringo".
   * Ranked like search: closed spots last, then by the strongest field that matched.
   */
  const servedAt = (names) => {
    const phrases = [...new Set(names.map(normalize).filter(Boolean))];
    const says = (text) => phrases.some((p) => [p, `${p}s`, `${p}es`].some((v) => ` ${text} `.includes(` ${v} `)));
    const rank = (s) => Math.min(...searchFields(s)
      .filter((f) => SERVES_FIELDS.includes(f.field) && says(f.words.join(' ')))
      .map((f) => SERVES_FIELDS.indexOf(f.field)));               // Infinity: no match
    return catalog.filter(hasValidCoordinates)
      .map((site) => ({ site, r: rank(site) }))
      .filter(({ r }) => r < Infinity)
      .sort((a, b) => (a.site.isClosed ? 1 : 0) - (b.site.isClosed ? 1 : 0) || a.r - b.r)
      .map(({ site }) => site);
  };

  const fns = {
    describe_dish({ name }) {
      const card = findEntry(kb.cards, name);
      const spots = servedAt(card ? [card.name, ...card.aliases] : [name]);
      if (!card) {
        return {
          found: false,
          note: `CartoTaco has no entry for "${name}" yet. Say so, and don't describe it from general knowledge.`,
          ...(spots.length ? { spots_mentioning_it: spots.slice(0, 4).map((s) => brief(s, now)) } : {})
        };
      }
      // The app shows these under the reply: credit comes from the data, not the model's wording
      actions.push({ type: 'sources', name: card.name, items: credits(card) });
      return { found: true, ...describeEntry(card), served_at: spots.slice(0, 3).map((s) => brief(s, now)), total_served_at: spots.length };
    },

    search_spots({ query, limit = 6, sort_by, near_est_id, ...args }) {
      if (args.favorites_only && !user.favoriteIds) throw new ToolError('The user is not signed in, so there are no favorites.');
      let pool = matching(toFilters(args));
      if (sort_by === 'heat') pool.sort((a, b) => (b.heatOverall ?? -1) - (a.heatOverall ?? -1));
      if (sort_by === 'salsas') pool.sort((a, b) => (b.salsaCount ?? -1) - (a.salsaCount ?? -1));
      const from = near_est_id != null ? spot(near_est_id) : null;
      if (from) {
        if (!hasValidCoordinates(from)) throw new ToolError(`${from.name} has no map location, so distances can't be measured.`);
        pool = pool.filter((s) => s !== from && hasValidCoordinates(s)).sort((a, b) => km(from, a) - km(from, b));
      }
      let hits = query
        ? searchSpots(query, pool, { limit: pool.length, complete: true }).map((h) => ({ site: h.site, matched: h.matchedOn.label }))
        : pool.map((site) => ({ site }));
      // searchSpots ranks by match; "near" puts distance back in charge
      if (from && query) hits.sort((a, b) => km(from, a.site) - km(from, b.site));
      const spots = hits.slice(0, limit).map(({ site, matched }) => ({
        ...brief(site, now),
        ...(matched ? { matched } : {}),
        ...(from ? { km_away: Math.round(km(from, site) * 10) / 10 } : {})
      }));
      // No total where it would mislead: a near search's total is city-wide (read as
      // "35 spots in that area"), and an unfiltered sorted listing matches every
      // spot (read as "36 spots with salsa variety")
      const listing = from || (!query && sort_by && !Object.keys(toFilters(args)).length);
      return listing ? { spots } : { total: hits.length, spots };
    },

    get_spot({ est_id }) {
      const s = spot(est_id);
      const hours = s.rawData.hours;
      // A closed spot's hours rows are history; leaving them out keeps a
      // model from reading them as current
      if (s.isClosed) return { ...brief(s, now), address: s.site.address || null, closed_since: s.closedAt };
      return {
        ...brief(s, now),
        address: s.site.address || null,
        today: todayHours(hours, now),
        about: s.shortDescription || null,
        ...(s.isPending ? {} : {
          proteins: s.topFiveProteinItems,
          protein_styles: Object.values(s.proteinStyles || {}).flat(),
          menu: s.topFiveMenuItems,
          tortillas: TORTILLAS[s.tortillaType] ?? null,
          handmade_tortillas: !!s.handmadeTortilla,
          // Named salsas only; `salsas` is the recorded total and can differ
          salsa_lineup: [...s.salsaVarieties.map((v) => v.name), ...s.otherSalsas.map((o) => o.name)],
          specialties: s.specialties.map((x) => x.name)
        })
      };
    },

    city_stats() {
      const stats = computeSummaryStats(catalog);
      const open = catalog.filter((s) => !s.isClosed);
      return {
        spots: open.length,
        visited: open.filter((s) => !s.isPending).length,
        open_now: matching({ openNow: true }).length,
        avg_heat: Math.round(stats.avgHeatLevel * 10) / 10,
        avg_salsas: Math.round(stats.avgSalsaNum * 10) / 10
      };
    },

    show_spot({ est_id }) {
      const s = spot(est_id);
      actions.push({ type: 'show_spot', est_id: s.est_id });
      return { shown: s.name };
    },

    plan_trail({ est_ids, mode = 'walking' }) {
      const stops = pickSpots(est_ids, [2, MAX_TRAIL], 'trail', { pending: true });
      const unplaced = stops.filter((s) => !hasValidCoordinates(s));
      if (unplaced.length) throw new ToolError(`${unplaced.map((s) => s.name).join(', ')} has no map location; leave it out.`);
      const order = nearestOrder(stops);
      if (!TRAIL_MODES.includes(mode)) mode = 'walking';
      // A re-plan replaces the earlier trail rather than stacking a second one
      const prev = actions.findIndex((a) => a.type === 'plan_trail');
      if (prev !== -1) actions.splice(prev, 1);
      actions.push({ type: 'plan_trail', est_ids: order.map((s) => s.est_id), mode });
      const legs = order.slice(1).map((s, i) => Math.round(km(order[i], s) * 10) / 10);
      const total = Math.round(legs.reduce((a, b) => a + b, 0) * 10) / 10;
      return {
        stops: order.map((s) => brief(s, now)),
        mode,
        straight_line_km: total,
        // A model picking stops by dish alone planned a 27 km "walk"
        ...(total > (LONG_TRAIL_KM[mode] ?? Infinity) ? {
          warning: `${total} km is long for ${mode}. Re-plan with closer stops (search_spots with near_est_id of the first stop) or suggest another mode.`
        } : {})
      };
    },

    compare_spots({ est_ids }) {
      const sites = pickSpots(est_ids, [2, MAX_COMPARE], 'comparison');
      actions.push({ type: 'compare', est_ids: sites.map((s) => s.est_id) });
      return { spots: sites.map((s) => fns.get_spot({ est_id: s.est_id })) };
    },

    start_summit({ est_ids, title }) {
      const sites = pickSpots(est_ids, SUMMIT_SPOTS, 'Taco Summit');
      const t = title?.trim().slice(0, 80) || undefined;
      actions.push({ type: 'start_summit', est_ids: sites.map((s) => s.est_id), ...(t ? { title: t } : {}) });
      return { spots: sites.map((s) => brief(s, now)), note: 'The user names the vote and shares the link from the Summit page.' };
    },

    recommend_for_me({ limit = 4 }) {
      if (!user.favoriteIds) throw new ToolError('The user is not signed in. Personal picks come from their favorites; suggest signing in and hearting a few spots.');
      const recs = recommendFor(catalog, user.favoriteIds, { favouriteSalsas: user.favouriteSalsas, k: Math.min(limit, 8) });
      if (!recs) throw new ToolError('The user has no favorite spots yet. Personal picks come from their favorites; suggest hearting a few spots.');
      return {
        based_on: catalog.filter((s) => user.favoriteIds.has(s.est_id)).map((s) => brief(s, now)),
        picks: recs.map((s) => ({
          ...brief(s, now),
          similarity: s.similarity,
          ...(s.matchedSalsas.length ? { serves_favourite_salsas: s.matchedSalsas.map((m) => m.name) } : {})
        }))
      };
    },

    apply_filters(args) {
      if (args.favorites_only && !user.favoriteIds) throw new ToolError('The user is not signed in, so there are no favorites.');
      const filters = toFilters(args);
      actions.push({ type: 'apply_filters', filters });
      const pool = matching(filters);
      return { matching: pool.length, spots: pool.slice(0, 6).map((s) => brief(s, now)) };
    }
  };

  const EstId = z.object({ est_id: z.number().int().describe('est_id from a tool result') });
  const EstIds = z.array(z.number().int()).describe('est_ids from tool results');
  const wrap = (name, description, schema) =>
    tool(async (args) => JSON.stringify(fns[name](args)), { name, description, schema });

  const tools = [
    wrap('describe_dish', 'What a dish, salsa, chile, protein style or other food is, from CartoTaco\'s sourced knowledgebase, and which spots serve it. Use it for "what is X", "qué es X", "what\'s in X".',
      z.object({ name: z.string().describe('The food, e.g. "chavindeca" or "salsa macha"') })),
    wrap('search_spots', 'Find spots by free text (name, dish, protein style, neighbourhood) and/or filters. Returns est_id, name, type, heat (0-10), salsa count and open status.',
      FilterArgs.extend({
        query: z.string().optional().describe('Free text, e.g. "birria" or "Apson"'),
        sort_by: z.enum(['heat', 'salsas']).optional().describe('Without a query, list the hottest or most-salsas spots first'),
        near_est_id: z.number().int().optional().describe('Closest to this spot first, with km_away (straight line)'),
        limit: z.number().int().min(1).max(8).optional()
      })),
    wrap('get_spot', 'Details for one spot: address, hours today, open status, proteins, menu, tortillas, salsa lineup, specialties.', EstId),
    wrap('city_stats', 'City-wide numbers: how many spots, how many are open now, average heat and salsa count.', z.object({})),
    wrap('show_spot', 'Fly the map to a spot and open its card.', EstId),
    wrap('plan_trail', 'Build a taco trail on the map from 2-8 open spots: orders the stops nearest-first and opens the Trail tray with a route.',
      z.object({ est_ids: EstIds, mode: z.enum(TRAIL_MODES).optional().describe('Default walking') })),
    wrap('compare_spots', 'Put 2-3 spots side by side in the Compare tray, and return their details to compare.',
      z.object({ est_ids: EstIds })),
    wrap('start_summit', 'Set up a Taco Summit (a group vote) with 2-6 spots: opens the Summit page with them picked, for the user to name and share.',
      z.object({ est_ids: EstIds, title: z.string().optional().describe('A name for the vote, if the user gave one') })),
    wrap('recommend_for_me', "Personal picks for the signed-in user: the spots closest to their favorites' proteins, heat and salsas.",
      z.object({ limit: z.number().int().min(1).max(8).optional() })),
    wrap('apply_filters', "Set the map's filters (replacing any the user had) and return the matching spots.",
      FilterArgs.extend({
        dish: z.string().optional().describe('Only spots matching this dish or protein style, e.g. "carnitas" or "birria"')
      }))
  ];

  return { fns, tools, actions };
}

// Which tools each routed intent may use (fewer tools, fewer wrong calls)
export const INTENT_TOOLS = {
  find_spot: ['search_spots', 'show_spot'],
  // Only apply_filters, which also returns the spots: given search_spots too,
  // Haiku answered from a search and left the map unfiltered
  filter: ['apply_filters'],
  // What a food is, then where to get it
  dish_info: ['describe_dish', 'search_spots', 'show_spot', 'apply_filters'],
  // city_stats for "how hot is X compared to the city?"
  spot_fact: ['search_spots', 'get_spot', 'city_stats', 'show_spot'],
  recommend: ['search_spots', 'get_spot', 'recommend_for_me', 'show_spot', 'apply_filters'],
  trail: ['search_spots', 'recommend_for_me', 'plan_trail'],
  compare: ['search_spots', 'compare_spots', 'city_stats'],
  summit: ['search_spots', 'recommend_for_me', 'start_summit'],
  default: ['search_spots', 'get_spot', 'city_stats', 'show_spot', 'apply_filters', 'describe_dish',
    'recommend_for_me', 'plan_trail', 'compare_spots', 'start_summit']
};

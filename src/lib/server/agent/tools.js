// src/lib/server/agent/tools.js
// The concierge's tools: plain functions over the catalog (processSites()
// spots), shared by the router's deterministic handlers and the agent loop.
// Read tools return compact JSON; action tools validate est_ids and record an
// action for the client to apply (src/lib/agentActions.js, phase 3).
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchSpots } from '../../search.js';
import { applyIntentFilters } from '../../intentRules.js';
import { matchesFilters, defaultFilterConfig, computeSummaryStats } from '../../siteModel.js';
import { getOpenStatus, todayHours } from '../../hours.js';

const PROTEINS = ['chicken', 'beef', 'pork', 'fish', 'veg'];
const TYPES = ['Brick and Mortar', 'Stand', 'Truck'];
// menu.flour_corn says which kinds are offered, not who makes them
const TORTILLAS = { both: 'corn and flour', corn: 'corn', flour: 'flour' };

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
  return filters;
}

/** The fields a model needs to talk about a spot, and no more. */
function brief(site, now) {
  const row = { est_id: site.est_id, name: site.name, type: site.type };
  if (site.isClosed) return { ...row, closed: true };
  if (site.isPending) return { ...row, pending: true, status: getOpenStatus(site.rawData.hours, now).label };
  return {
    ...row,
    heat: site.heatOverall,
    salsas: site.salsaCount,
    status: getOpenStatus(site.rawData.hours, now).label
  };
}

/**
 * Build the tool set for one request.
 *
 * @param {{ catalog: object[], now?: Date, user?: { favoriteIds?: Set<number> } }} ctx
 * @returns {{ fns: object, tools: object[], actions: object[] }}
 */
export function makeTools({ catalog, now = new Date(), user = {} }) {
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

  const fns = {
    search_spots({ query, limit = 6, sort_by, ...args }) {
      if (args.favorites_only && !user.favoriteIds) throw new ToolError('The user is not signed in, so there are no favorites.');
      const pool = matching(toFilters(args));
      if (sort_by === 'heat') pool.sort((a, b) => (b.heatOverall ?? -1) - (a.heatOverall ?? -1));
      if (sort_by === 'salsas') pool.sort((a, b) => (b.salsaCount ?? -1) - (a.salsaCount ?? -1));
      const hits = query
        ? searchSpots(query, pool, { limit }).map((h) => ({ ...brief(h.site, now), matched: h.matchedOn.label }))
        : pool.slice(0, limit).map((s) => brief(s, now));
      return { total: query ? hits.length : pool.length, spots: hits };
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

    apply_filters(args) {
      if (args.favorites_only && !user.favoriteIds) throw new ToolError('The user is not signed in, so there are no favorites.');
      const filters = toFilters(args);
      actions.push({ type: 'apply_filters', filters });
      const pool = matching(filters);
      return { matching: pool.length, spots: pool.slice(0, 6).map((s) => brief(s, now)) };
    }
  };

  const EstId = z.object({ est_id: z.number().int().describe('est_id from a tool result') });
  const wrap = (name, description, schema) =>
    tool(async (args) => JSON.stringify(fns[name](args)), { name, description, schema });

  const tools = [
    wrap('search_spots', 'Find spots by free text (name, dish, protein style, neighbourhood) and/or filters. Returns est_id, name, type, heat (0-10), salsa count and open status.',
      FilterArgs.extend({
        query: z.string().optional().describe('Free text, e.g. "birria" or "Apson"'),
        sort_by: z.enum(['heat', 'salsas']).optional().describe('Without a query, list the hottest or most-salsas spots first'),
        limit: z.number().int().min(1).max(8).optional()
      })),
    wrap('get_spot', 'Details for one spot: address, hours today, open status, proteins, menu, tortillas, salsa lineup, specialties.', EstId),
    wrap('city_stats', 'City-wide numbers: how many spots, how many are open now, average heat and salsa count.', z.object({})),
    wrap('show_spot', 'Fly the map to a spot and open its card.', EstId),
    wrap('apply_filters', "Set the map's filters (replacing any the user had) and return the matching spots.", FilterArgs)
  ];

  return { fns, tools, actions };
}

// Which tools each routed intent may use (fewer tools, fewer wrong calls)
export const INTENT_TOOLS = {
  find_spot: ['search_spots', 'show_spot'],
  // Only apply_filters, which also returns the spots: given search_spots too,
  // Haiku answered from a search and left the map unfiltered
  filter: ['apply_filters'],
  spot_fact: ['search_spots', 'get_spot', 'show_spot'],
  recommend: ['search_spots', 'get_spot', 'city_stats', 'show_spot', 'apply_filters'],
  default: ['search_spots', 'get_spot', 'city_stats', 'show_spot', 'apply_filters']
};

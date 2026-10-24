// src/lib/siteModel.js
// Pure site-data logic: turning sites_complete rows into component-ready
// spots, city stats, and the filter predicate. No stores and no Supabase
// client, so the browser stores, the server, and offline evals all share it.

import { filterObjectByKeySubstring, getTopFive, extractProteinStyles } from "./dataWrangling.js";
import { getOpenStatus } from "./hours.js";

// Legacy data uses the literal string 'NA' as a null marker
function cleanNA(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' || s.toUpperCase() === 'NA' ? null : value;
}

// Named salsa varieties tracked as boolean columns on the salsa table
const SALSA_VARIETIES = [
  { key: 'verde', label: 'Verde' },
  { key: 'rojo', label: 'Rojo' },
  { key: 'pico', label: 'Pico' },
  { key: 'pickles', label: 'Pickles' },
  { key: 'chipotle', label: 'Chipotle' },
  { key: 'avo', label: 'Avocado' },
  { key: 'molcajete', label: 'Molcajete' },
  { key: 'macha', label: 'Macha' }
];

/**
 * One sites_complete row → a component-ready spot, or null when the row is
 * missing a child table.
 */
export function processSite(site) {
  // Skip sites with missing required data
  if (!site.site || !site.descriptions || !site.menu ||
      !site.hours || !site.salsa || !site.protein) {
    return null;
  }

  try {
    // Pending (unvetted) spots are web-scraped: they have no menu/protein/
    // salsa rows yet, so skip that pre-computation and give them empty
    // component-ready values. Hours/contact may exist from scraping.
    const isPending = site.site.vetting_status === 'pending';

    // Closed spots keep every measurement we recorded while they were open
    // (unlike pending spots, which never had any) — they just stop counting
    // toward city-wide stats and get marked closed everywhere they appear.
    const isClosed = !!site.site.closed_at;

    // Pre-compute values used by components
    const menuPercs = filterObjectByKeySubstring(site.menu, "perc");
    const proteinPercs = filterObjectByKeySubstring(site.protein, "perc");
    const startHours = filterObjectByKeySubstring(site.hours, "start");
    const endHours = filterObjectByKeySubstring(site.hours, "end");

    let menuArray = [];
    let proteinArray = [];
    if (!isPending) {
      // Filter to items the establishment actually serves (_yes = true) before ranking,
      // so the radar only shows offered items rather than cutting off real ones
      // due to global top-5 competition with the full 16-item pool.
      const activeMenuPercs = menuPercs.filter(([key]) => {
        const yesKey = key.replace('_perc', '_yes');
        return site.menu[yesKey] === true;
      });

      // Pre-compute top five menu items and proteins
      menuArray = getTopFive(activeMenuPercs, 7);

      // Pad with inactive items (value=0) so there are always at least 4 radar axes
      const MIN_RADAR_ITEMS = 4;
      if (menuArray.length < MIN_RADAR_ITEMS) {
        const activeKeys = new Set(activeMenuPercs.map(([k]) => k));
        const inactiveMenuItems = menuPercs
          .filter(([key]) => !activeKeys.has(key))
          .slice(0, MIN_RADAR_ITEMS - menuArray.length)
          .map(([key]) => [key.replace('_perc', ''), 0]);
        menuArray.push(...inactiveMenuItems);
      }

      proteinArray = getTopFive(proteinPercs);
    }

    const topFiveMenuItems = menuArray.map(subArray => subArray[0]);
    // Convert to numbers and multiply by 100 to get percentages
    const topFiveMenuValues = menuArray.map(subArray => {
      const value = parseFloat(subArray[1]);
      return isNaN(value) ? 0 : value * 100;
    });

    const topFiveProteinItems = proteinArray.map(subArray => subArray[0]);
    // Convert to numbers and multiply by 100 to get percentages
    const topFiveProteinValues = proteinArray.map(subArray => {
      const value = parseFloat(subArray[1]);
      return isNaN(value) ? 0 : value * 100;
    });

    // Return processed site data with pre-computed values
    return {
      est_id: site.est_id,
      site: site.site,
      // Basic site details
      name: site.site.name,
      type: site.site.type,
      longitude: site.site.lon_1,
      latitude: site.site.lat_1,
      createdAt: site.site.created_at, // Track creation date for "new spots" feature

      // Vetting status ('vetted' | 'pending') — pending spots are
      // web-scraped preliminary entries awaiting an editorial visit
      vettingStatus: site.site.vetting_status || 'vetted',
      isPending,
      isClosed,
      closedAt: site.site.closed_at || null,
      sourceUrl: site.site.source_url || null,

      // Descriptions
      shortDescription: site.descriptions.short_descrip,
      longDescription: site.descriptions.long_descrip,

      // Hours (pre-processed)
      startHours,
      endHours,

      // Menu data (pre-processed)
      menuItems: menuPercs,
      topFiveMenuItems,
      topFiveMenuValues,

      // Protein data (pre-processed)
      menuProtein: proteinPercs,
      topFiveProteinItems,
      topFiveProteinValues,
      proteinStyles: extractProteinStyles(site.protein),

      // Salsa and spice data
      salsaCount: site.salsa.total_num,
      heatOverall: site.salsa.heat_overall,

      // Per-salsa lineup: named varieties served + up to 3 "other" salsas
      // (each with its own name, heat, and description) from the salsa table.
      // Legacy rows use the literal string 'NA' as a null marker.
      salsaVarieties: isPending ? [] : SALSA_VARIETIES
        .filter(v => site.salsa[`${v.key}_yes`] === true)
        .map(v => ({ name: v.label })),
      // Catalog styles from site_salsas (migration 037): slug, name,
      // definitive hex colour, and optional per-spot heat / note. Each
      // links to /salsa/[slug].
      salsaStyles: isPending ? [] : (site.salsa.styles || []),
      otherSalsas: isPending ? [] : [1, 2, 3]
        .map(n => ({
          name: cleanNA(site.salsa[`other_${n}_name`]),
          heat: cleanNA(site.salsa[`other_${n}_heat`]),
          description: cleanNA(site.salsa[`other_${n}_descrip`])
        }))
        .filter(s => s.name),

      // Other details
      tortillaType: site.menu.flour_corn,
      handmadeTortilla: site.menu.handmade_tortilla ?? false,

      // Specialty items — embedded in the view, no separate fetch needed
      specialties: [
        ...(site.menu.specialty_items || []).map(s => ({ ...s, type: 'Item' })),
        ...(site.protein.specialty_proteins || []).map(s => ({ ...s, type: 'Protein' })),
        ...(site.salsa.specialty_salsas || []).map(s => ({ ...s, type: 'Salsa' }))
      ],

      // Original data (for complex processing that can't be pre-computed)
      rawData: site
    };
  } catch (error) {
    console.error(`Error processing site ${site.est_id}:`, error);
    return null;
  }
}

/** Every sites_complete row → component-ready spots, skipping broken rows. */
export function processSites(rows) {
  if (!rows || rows.length === 0) return [];
  return rows.map(processSite).filter(site => site !== null);
}

// Pending (unvetted) spots have no measurements and closed spots are history:
// neither counts toward city-wide stats.
function cityPool(sites) {
  return (sites || []).filter(s => !s.isPending && !s.isClosed);
}

/** City max/average salsa count and heat over open, vetted spots. */
export function computeSummaryStats(sites) {
  const vettedSites = cityPool(sites);
  if (vettedSites.length === 0) {
    return {
      maxSalsaNum: 0,
      avgSalsaNum: 0,
      maxHeatLevel: 0,
      avgHeatLevel: 0
    };
  }

  const salsaCounts = vettedSites.map(s => s.salsaCount || 0);
  const heatLevels = vettedSites.map(s => s.heatOverall || 0);

  return {
    maxSalsaNum: Math.max(...salsaCounts),
    avgSalsaNum: salsaCounts.reduce((a, b) => a + b, 0) / salsaCounts.length,
    maxHeatLevel: Math.max(...heatLevels),
    avgHeatLevel: heatLevels.reduce((a, b) => a + b, 0) / heatLevels.length
  };
}

/** The city distribution percentiles and context strips are drawn from. */
export function computeDistributionPool(sites) {
  const vettedSites = cityPool(sites);
  return {
    ids: vettedSites.map(s => s.est_id),
    heats: vettedSites.map(s => s.heatOverall || 0),
    salsas: vettedSites.map(s => s.salsaCount || 0)
  };
}

/**
 * Per-spot percentile ranks within the city distribution.
 * *Percentile = share of spots strictly lower; *PercentileAbove = share
 * strictly higher. Ties count as neither, so Above is not 100 - Percentile.
 * *Tied = another spot shares this value ("Tied for hottest").
 */
export function computeDistributionStats({ ids, heats, salsas }) {
  const stats = new Map();
  if (heats.length < 2) {
    return stats;
  }

  // 0 and 100 are reserved for "no spot on that side", so a tiny share
  // never rounds into a false "hottest" / "mildest"
  const share = (count, n) =>
    count === 0 ? 0 : count === n ? 100 : Math.min(99, Math.max(1, Math.round((count / n) * 100)));
  const below = (values, v) => share(values.filter(x => x < v).length, values.length);
  const above = (values, v) => share(values.filter(x => x > v).length, values.length);
  const tied = (values, v) => values.filter(x => x === v).length > 1;

  ids.forEach((id, i) => {
    const heat = heats[i];
    const salsa = salsas[i];
    stats.set(id, {
      heatPercentile: below(heats, heat),
      heatPercentileAbove: above(heats, heat),
      heatTied: tied(heats, heat),
      salsaPercentile: below(salsas, salsa),
      salsaPercentileAbove: above(salsas, salsa),
      salsaTied: tied(salsas, salsa)
    });
  });
  return stats;
}

/** A fresh filterConfig with nothing filtered. */
export function defaultFilterConfig() {
  return {
    searchText: '',
    proteins: {
      chicken: false,
      beef: false,
      pork: false,
      fish: false,
      veg: false
    },
    types: {
      'Brick and Mortar': false,
      'Stand': false,
      'Truck': false
    },
    spiceLevel: { min: 0, max: 10 },
    openNow: false,
    showFavoritesOnly: false,
    showPending: true,
    showClosed: true,
    salsaStyle: null, // salsa_styles slug; set from /?salsa=<slug> by the Salsa Atlas
    styleFilters: {
      chicken: [],
      beef: [],
      pork: [],
      fish: [],
      veg: []
    }
  };
}

// Tucson metro bounding box. Same numbers as the bad_coordinates check in
// data_health_report() (migrations 034/035) — keep the two in sync. The south edge takes in Green Valley.
const TUCSON_BOUNDS = { minLat: 31.8, maxLat: 32.6, minLon: -111.4, maxLon: -110.5 };

/**
 * True when a site's coordinates land inside the Tucson metro area.
 *
 * Scraped pending spots arrive with no coordinates at all when the geocoder
 * misses. A truthiness check hides their markers but not the camera: Mapbox
 * reads [null, null] as [0, 0], so searching for one or hitting Surprise Me
 * sailed the map to the Gulf of Guinea. A spot we can't place isn't a map
 * destination, so it stays out of the map-facing stores. The nightly data
 * health report flags the same rows for a human to fix at the source.
 *
 * ponytail: a flat bounding box, not a real polygon — a spot misplaced *within*
 * the box still renders. Tighten it only if that starts happening.
 */
export function hasValidCoordinates(site) {
  const lon = Number(site?.longitude);
  const lat = Number(site?.latitude);
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lat >= TUCSON_BOUNDS.minLat &&
    lat <= TUCSON_BOUNDS.maxLat &&
    lon >= TUCSON_BOUNDS.minLon &&
    lon <= TUCSON_BOUNDS.maxLon
  );
}

// Is a spot open at `now` on Tucson's clock? Takes the raw hours object from
// the view (keys like mon_start, mon_end).
export function isOpenNow(hours, now = new Date()) {
  return getOpenStatus(hours, now).isOpen;
}

/**
 * Does a spot pass the filters? The predicate behind filteredTacoData, also
 * used by search tools that filter without the stores.
 *
 * @param {object} site - a processSite() spot
 * @param {object} cfg - filterConfig shape
 * @param {Set} [favIds] - favorited est_ids, for showFavoritesOnly
 * @param {Date} [now] - for openNow
 */
export function matchesFilters(site, cfg, favIds = new Set(), now = new Date()) {
  // A spot we can't place on the map can't be a map result either — it
  // would render no marker and fly the camera to [0, 0] if picked.
  if (!hasValidCoordinates(site)) {
    return false;
  }

  // Pending (unvetted) spots — shown by default, hideable via toggle.
  // Note: active protein/spice/style filters below also exclude pending
  // spots, intentionally — we can't verify they meet any requirement.
  if (!cfg.showPending && site.isPending) {
    return false;
  }

  // Closed spots — shown by default so users learn a spot closed rather
  // than finding nothing, hideable via toggle
  if (!cfg.showClosed && site.isClosed) {
    return false;
  }

  // Salsa style filter ("Show on the map" from a Salsa Atlas page)
  if (cfg.salsaStyle &&
      !(site.salsaStyles || []).some(s => s.slug === cfg.salsaStyle)) {
    return false;
  }

  // Favorites only filter
  if (cfg.showFavoritesOnly) {
    if (!favIds.has(site.est_id)) {
      return false;
    }
  }

  // Search text filter (name, descriptions, type, menu items, proteins, protein styles, specialties)
  if (cfg.searchText) {
    const searchLower = cfg.searchText.toLowerCase();
    const matched =
      site.name?.toLowerCase().includes(searchLower) ||
      site.shortDescription?.toLowerCase().includes(searchLower) ||
      site.longDescription?.toLowerCase().includes(searchLower) ||
      site.type?.toLowerCase().includes(searchLower) ||
      site.topFiveMenuItems?.some(item => item.toLowerCase().includes(searchLower)) ||
      site.topFiveProteinItems?.some(item => item.toLowerCase().includes(searchLower)) ||
      Object.values(site.proteinStyles || {}).some(styles => styles.some(s => s.toLowerCase().includes(searchLower))) ||
      site.specialties?.some(s =>
        s.name?.toLowerCase().includes(searchLower) ||
        s.description?.toLowerCase().includes(searchLower)
      );
    if (!matched) return false;
  }

  // Protein filters
  const activeProteins = Object.entries(cfg.proteins)
    .filter(([_, isActive]) => isActive)
    .map(([protein, _]) => protein);

  if (activeProteins.length > 0) {
    const hasAnyProtein = activeProteins.some(protein => {
      const proteinKey = `${protein}_yes`;
      return site.rawData?.protein?.[proteinKey] === true;
    });
    if (!hasAnyProtein) return false;
  }

  // Style filters — only applied when a protein is active and has style selections
  for (const protein of activeProteins) {
    const selectedStyles = cfg.styleFilters[protein];
    if (!selectedStyles || selectedStyles.length === 0) continue;
    const siteStyles = (site.proteinStyles?.[protein] || []).map(s => s.toLowerCase());
    const hasStyle = selectedStyles.some(s => siteStyles.includes(s.toLowerCase()));
    if (!hasStyle) return false;
  }

  // Type filters
  const activeTypes = Object.entries(cfg.types)
    .filter(([_, isActive]) => isActive)
    .map(([type, _]) => type);

  if (activeTypes.length > 0) {
    if (!activeTypes.includes(site.type)) {
      return false;
    }
  }

  // Spice level filter
  const siteSpiceLevel = site.heatOverall || 0;
  if (siteSpiceLevel < cfg.spiceLevel.min ||
      siteSpiceLevel > cfg.spiceLevel.max) {
    return false;
  }

  // Open now filter — a closed spot is never open now, whatever its
  // stale hours rows still say
  if (cfg.openNow) {
    if (site.isClosed) return false;
    if (!isOpenNow(site.rawData.hours, now)) {
      return false;
    }
  }

  return true;
}

// Tucson Taco Census aggregates (N2 of the UI refresh).
// Everything derives client-side from processedTacoData — no new queries.
// The logic is computeCensus in siteModel.js, shared with /api/census.
import { derived } from 'svelte/store';
import { processedTacoData } from './stores';
import { computeCensus } from './siteModel.js';

export const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const censusStats = derived(processedTacoData, ($allSites) => computeCensus($allSites));

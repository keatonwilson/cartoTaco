// Map lens state (N3 of the UI refresh): lets the map itself encode data.
// 'spots'   — default clustered markers
// 'heat'    — every spot colored by heat_overall on the sequential coral ramp
// 'salsa'   — every spot sized by salsa count
// 'density' — Mapbox heatmap of spot concentration
import { writable } from 'svelte/store';

// Data lenses hide pending (unvetted) spots — they have no measurements yet
export const LENSES = [
	{ id: 'spots', label: 'Spots', legend: null },
	{ id: 'heat', label: 'Heat', legend: 'Color = heat level (0–10) · pending spots hidden' },
	{ id: 'salsa', label: 'Salsas', legend: 'Size = number of salsas · pending spots hidden' },
	{ id: 'density', label: 'Density', legend: 'Where the vetted taco spots concentrate' }
];

export const mapLens = writable('spots');

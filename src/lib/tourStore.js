// src/lib/tourStore.js
// Manages onboarding tour state with localStorage persistence

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'cartoTaco_tourCompleted';

// Tour step definitions
export const TOUR_STEPS = [
	{
		id: 'welcome',
		target: null,
		title: 'Welcome to CartoTaco!',
		description: 'Your interactive guide to the best tacos in Tucson. Let us show you around!'
	},
	{
		id: 'search',
		target: '[data-tour="search"]',
		title: 'Search & Discover',
		description: 'Search by name, menu item, protein, or type to find exactly what you\'re craving.'
	},
	{
		id: 'filters',
		target: '[data-tour="filters"]',
		title: 'Filter Your Results',
		description: 'Narrow down by protein, establishment type, spice level, hours, and more.',
		onEnter: 'expandFilters'
	},
	{
		id: 'trail',
		target: '[data-tour="trail"]',
		title: 'Build a Taco Trail',
		description: 'Plan a multi-stop taco crawl! Click spots on the map to add them to your route.'
	},
	{
		id: 'map',
		target: null,
		title: 'Explore the Map',
		description: 'Click clusters to zoom in, click markers to see details. Drag and zoom to explore all of Tucson.'
	},
	{
		id: 'theme',
		target: '[data-tour="theme"]',
		title: 'Switch Themes',
		description: 'Toggle between light, dark, and auto modes to suit your preference.'
	},
	{
		id: 'done',
		target: null,
		title: "You're Ready!",
		description: 'Start exploring Tucson\'s taco scene. You can restart this tour anytime from the help button.'
	}
];

// Stores
export const tourActive = writable(false);
export const tourStep = writable(0);
export const tourExpandFilters = writable(false);

// Start the tour
export function startTour() {
	tourStep.set(0);
	tourActive.set(true);
}

// End the tour and mark as completed
export function endTour() {
	tourActive.set(false);
	tourStep.set(0);
	tourExpandFilters.set(false);

	if (browser) {
		localStorage.setItem(STORAGE_KEY, 'true');
	}
}

// Go to next step
export function nextStep() {
	tourStep.update(step => {
		const next = step + 1;
		if (next >= TOUR_STEPS.length) {
			endTour();
			return 0;
		}
		// Handle onEnter actions
		const nextStepDef = TOUR_STEPS[next];
		if (nextStepDef.onEnter === 'expandFilters') {
			tourExpandFilters.set(true);
		}
		return next;
	});
}

// Go to previous step
export function prevStep() {
	tourStep.update(step => Math.max(0, step - 1));
}

// Check if tour should auto-start (first visit)
export function shouldAutoStart() {
	if (!browser) return false;
	return !localStorage.getItem(STORAGE_KEY);
}

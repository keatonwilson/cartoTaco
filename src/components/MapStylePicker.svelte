<script>
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { getAvailableStyles, getMapStyle } from '$lib/mapStyles.js';
	import { MapPinAltOutline } from 'flowbite-svelte-icons';

	// Props
	export let onStyleChange = null;

	// Available styles
	const styles = getAvailableStyles();

	// Create a store for selected style (persists to localStorage)
	const selectedStyleId = writable('standard');

	// Initialize from localStorage
	if (browser) {
		const stored = localStorage.getItem('mapStyle');
		if (stored) {
			selectedStyleId.set(stored);
		}

		// Subscribe to changes and persist
		selectedStyleId.subscribe((value) => {
			localStorage.setItem('mapStyle', value);
			if (onStyleChange) {
				onStyleChange(value);
			}
		});
	}

	// Export selected style ID for parent component
	export { selectedStyleId };

	// UI state
	let isOpen = false;

	function togglePicker() {
		isOpen = !isOpen;
	}

	function selectStyle(styleId) {
		selectedStyleId.set(styleId);
		isOpen = false;
	}

	// Get currently selected style object
	$: currentStyle = styles.find((s) => s.id === $selectedStyleId) || styles[0];
</script>

<div class="map-style-picker">
	<button class="picker-button" on:click={togglePicker} title="Change map style">
		<span class="map-icon">🗺️</span>
		<span class="button-text">{currentStyle.name}</span>
	</button>

	{#if isOpen}
		<div class="picker-dropdown">
			<div class="dropdown-header">
				<h3>Map Style</h3>
				<button class="close-button" on:click={() => (isOpen = false)} aria-label="Close">×</button>
			</div>

			<div class="styles-grid">
				{#each styles as style}
					<button
						class="style-option"
						class:active={style.id === $selectedStyleId}
						on:click={() => selectStyle(style.id)}
					>
						<div class="style-info">
							<div class="style-name">{style.name}</div>
							<div class="style-description">{style.description}</div>
						</div>
						{#if style.id === $selectedStyleId}
							<div class="checkmark">✓</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Overlay to close dropdown when clicking outside -->
		<button class="overlay" on:click={() => (isOpen = false)} aria-label="Close picker"></button>
	{/if}
</div>

<style>
	.map-style-picker {
		position: relative;
		z-index: 10;
	}

	.picker-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		color: #374151;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.picker-button:hover {
		background: white;
		border-color: #fe795d;
		color: #fe795d;
	}

	.map-icon {
		font-size: 1rem;
	}

	.button-text {
		display: none;
	}

	@media (min-width: 640px) {
		.button-text {
			display: inline;
		}
	}

	.picker-dropdown {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		min-width: 280px;
		max-width: 320px;
		background: white;
		border: 2px solid #fe795d;
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
		padding: 1rem;
		z-index: 100;
	}

	.dropdown-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.dropdown-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.styles-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.style-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		width: 100%;
	}

	.style-option:hover {
		background: #f3f4f6;
		border-color: #fe795d;
	}

	.style-option.active {
		background: #fff5f2;
		border-color: #fe795d;
		border-width: 2px;
	}

	.style-info {
		flex: 1;
	}

	.style-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.125rem;
	}

	.style-description {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.checkmark {
		font-size: 1.25rem;
		color: #fe795d;
		font-weight: bold;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: transparent;
		border: none;
		padding: 0;
		cursor: default;
		z-index: 50;
	}

	/* Dark mode support */
	:global(.dark) .picker-button {
		background: rgba(31, 41, 55, 0.9);
		border-color: #4b5563;
		color: #d1d5db;
	}

	:global(.dark) .picker-button:hover {
		background: #1f2937;
		border-color: #fe795d;
		color: #fe795d;
	}

	:global(.dark) .picker-dropdown {
		background: #1f2937;
		border-color: #fe795d;
	}

	:global(.dark) .dropdown-header {
		border-color: #374151;
	}

	:global(.dark) .dropdown-header h3 {
		color: #f9fafb;
	}

	:global(.dark) .close-button {
		color: #9ca3af;
	}

	:global(.dark) .close-button:hover {
		background: #374151;
		color: #f9fafb;
	}

	:global(.dark) .style-option {
		background: #111827;
		border-color: #374151;
	}

	:global(.dark) .style-option:hover {
		background: #0f172a;
		border-color: #fe795d;
	}

	:global(.dark) .style-option.active {
		background: #1f2937;
		border-color: #fe795d;
	}

	:global(.dark) .style-name {
		color: #f9fafb;
	}

	:global(.dark) .style-description {
		color: #9ca3af;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.picker-dropdown {
			left: auto;
			right: 0;
			min-width: 260px;
		}
	}
</style>

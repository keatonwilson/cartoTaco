<script>
	import { themePreference } from '$lib/theme.js';
	import { browser } from '$app/environment';
	import { SunOutline, MoonOutline, ClockOutline } from 'flowbite-svelte-icons';

	const themes = [
		{ value: 'light', label: 'Light', icon: SunOutline },
		{ value: 'auto', label: 'Auto', icon: ClockOutline },
		{ value: 'dark', label: 'Dark', icon: MoonOutline }
	];

	function setTheme(value) {
		themePreference.set(value);
	}
</script>

<div class="theme-toggle">
	{#each themes as theme}
		<button
			class="theme-button"
			class:active={$themePreference === theme.value}
			on:click={() => setTheme(theme.value)}
			title="{theme.label} mode"
			aria-label="Set {theme.label} theme"
		>
			{#if browser}
				<svelte:component this={theme.icon} size="sm" />
			{/if}
			<span class="theme-label">{theme.label}</span>
		</button>
	{/each}
</div>

<style>
	.theme-toggle {
		display: flex;
		gap: 0.25rem;
		background: rgba(255, 255, 255, 0.7);
		padding: 0.25rem;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.theme-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: #6b7280;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.theme-button:hover {
		background: rgba(254, 121, 93, 0.1);
		color: #fe795d;
	}

	.theme-button.active {
		background: #fe795d;
		color: white;
	}

	.theme-label {
		display: none;
	}

	/* Dark mode styles */
	:global(.dark) .theme-toggle {
		background: rgba(31, 41, 55, 0.8);
		border-color: #374151;
	}

	:global(.dark) .theme-button {
		color: #9ca3af;
	}

	:global(.dark) .theme-button:hover {
		background: rgba(254, 121, 93, 0.2);
		color: #fe795d;
	}

	:global(.dark) .theme-button.active {
		background: #fe795d;
		color: white;
	}

	/* Show labels on larger screens */
	@media (min-width: 640px) {
		.theme-label {
			display: inline;
		}

		.theme-button {
			padding: 0.5rem 0.875rem;
		}
	}

	/* Mobile: compact icon-only view */
	@media (max-width: 639px) {
		.theme-button {
			padding: 0.5rem;
		}
	}
</style>

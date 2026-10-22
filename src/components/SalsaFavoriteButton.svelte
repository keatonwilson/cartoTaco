<script>
	// Heart for a salsa style. Takes its colours from the surrounding text
	// (currentColor), so it works on any salsa-coloured hero.
	import Heart from 'phosphor-svelte/lib/Heart';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/authStore';
	import { favoriteSalsaSlugs, toggleSalsaFavorite } from '$lib/salsaFavoritesStore';

	export let style;

	$: favourited = $favoriteSalsaSlugs.has(style.slug);

	function handleClick() {
		if (!$isAuthenticated) {
			goto('/login');
			return;
		}
		toggleSalsaFavorite(style);
	}
</script>

<button type="button" class="salsa-fav" class:favourited aria-pressed={favourited} on:click={handleClick}>
	<Heart size={16} weight={favourited ? 'fill' : 'regular'} />
	{favourited ? 'Favourited' : 'Favourite this salsa'}
</button>

<style>
	.salsa-fav {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 16px;
		border: 1.5px solid currentColor;
		border-radius: 999px;
		background: transparent;
		color: inherit;
		font: 600 13px/1.2 var(--font-text);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.salsa-fav:hover {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.salsa-fav.favourited {
		background: color-mix(in srgb, currentColor 22%, transparent);
	}

	.salsa-fav:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 3px;
	}

	.favourited :global(svg) {
		animation: beat 0.35s cubic-bezier(0.3, 1.6, 0.4, 1);
	}

	@keyframes beat {
		from {
			transform: scale(0.5);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.favourited :global(svg) {
			animation: none;
		}
	}
</style>

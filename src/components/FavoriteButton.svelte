<script>
	import { HeartSolid, HeartOutline } from 'flowbite-svelte-icons';
	import { favoriteIds, toggleFavorite } from '$lib/favoritesStore';
	import { isAuthenticated } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	export let estId;
	export let size = 'md'; // 'sm', 'md', or 'lg'

	let isToggling = false;

	// Reactive check if this location is favorited
	$: isFavorited = $favoriteIds.has(estId);

	async function handleToggle() {
		console.log('FavoriteButton clicked for estId:', estId);
		console.log('Is authenticated:', $isAuthenticated);

		// Redirect to login if not authenticated
		if (!$isAuthenticated) {
			console.log('Not authenticated, redirecting to login');
			goto('/login?redirect=/');
			return;
		}

		if (isToggling) {
			console.log('Already toggling, ignoring click');
			return;
		}

		isToggling = true;
		try {
			console.log('Toggling favorite for:', estId);
			const result = await toggleFavorite(estId);
			console.log('Toggle result:', result);
		} catch (error) {
			console.error('Error toggling favorite:', error);
		} finally {
			isToggling = false;
		}
	}

	// Size mappings
	const sizeMap = {
		sm: 'sm',
		md: 'md',
		lg: 'lg'
	};
	$: iconSize = sizeMap[size] || 'md';
</script>

<button
	class="favorite-button"
	class:favorited={isFavorited}
	class:loading={isToggling}
	class:size-sm={size === 'sm'}
	on:click={handleToggle}
	disabled={isToggling}
	title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
	aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
>
	{#if browser}
		{#if isFavorited}
			<HeartSolid size={iconSize} class="heart-icon" />
		{:else}
			<HeartOutline size={iconSize} class="heart-icon" />
		{/if}
	{/if}
	<span class="button-text">
		{#if isFavorited}
			Favorited
		{:else}
			Add to Favorites
		{/if}
	</span>
</button>

<style>
	.favorite-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border: 2px solid #e0e0e0;
		background: white;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 14px;
		font-weight: 600;
		color: #666;
	}

	.favorite-button.size-sm {
		padding: 4px 10px;
		font-size: 11px;
		gap: 4px;
	}

	:global(.dark) .favorite-button {
		background: #1f2937;
		border-color: #4b5563;
		color: #9ca3af;
	}

	.favorite-button:hover:not(:disabled) {
		border-color: #ff6b6b;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(255, 107, 107, 0.2);
	}

	.favorite-button.favorited {
		border-color: #ff6b6b;
		background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
		color: white;
	}

	:global(.dark) .favorite-button.favorited {
		background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
		border-color: #dc2626;
	}

	.favorite-button.favorited:hover:not(:disabled) {
		background: linear-gradient(135deg, #ff5252 0%, #ff6b6b 100%);
		box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
	}

	.favorite-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.favorite-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.favorite-button.loading {
		pointer-events: none;
	}

	.favorite-button :global(.heart-icon) {
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}

	.favorite-button:hover :global(.heart-icon) {
		transform: scale(1.1);
	}

	.favorite-button.favorited :global(.heart-icon) {
		animation: heartBeat 0.3s ease;
	}

	@keyframes heartBeat {
		0%, 100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.2);
		}
	}

	.button-text {
		white-space: nowrap;
	}

	/* Mobile: Hide text, show only icon for compact view */
	@media (max-width: 640px) {
		.button-text {
			display: none;
		}

		.favorite-button {
			padding: 10px;
			min-width: 44px;
			justify-content: center;
		}
	}
</style>

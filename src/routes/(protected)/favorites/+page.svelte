<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import Heart from 'phosphor-svelte/lib/Heart';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import { favoriteIds, loadFavorites } from '$lib/favoritesStore';
	import { processedTacoData } from '$lib/stores';
	import FavoriteButton from '../../../components/FavoriteButton.svelte';
	import EmptyState from '../../../components/EmptyState.svelte';
	import LoadingState from '../../../components/LoadingState.svelte';

	export let data;

	let favoriteLocations = [];
	let loading = true;

	// Load favorites when page mounts
	onMount(async () => {
		await loadFavorites();
		loading = false;
	});

	// Update favorite locations when favoriteIds or processedTacoData changes
	$: {
		if ($favoriteIds && $processedTacoData) {
			favoriteLocations = $processedTacoData.filter(site =>
				$favoriteIds.has(site.est_id)
			);
		}
	}

	function viewOnMap(site) {
		// Navigate to home and trigger map to show this location
		goto(`/?location=${site.est_id}`);
	}
</script>

<svelte:head>
	<title>My Favorites - CartoTaco</title>
</svelte:head>

<div class="favorites-container">
	<div class="favorites-content">
		<!-- Header -->
		<div class="favorites-header">
			{#if browser}
				<Heart weight="fill" class="header-icon" size={32} />
			{/if}
			<h1 class="favorites-title">My Favorite Taco Spots</h1>
			<p class="favorites-subtitle">
				{favoriteLocations.length} {favoriteLocations.length === 1 ? 'location' : 'locations'} saved
			</p>
		</div>

		<!-- Loading State -->
		{#if loading}
			<LoadingState message="Fetching your favorites…" />
		{:else if favoriteLocations.length === 0}
			<div class="empty-card">
				<EmptyState
					emoji="💔"
					title="No favorites yet"
					message="Start exploring the map and save your favorite taco spots!"
					ctaLabel="Explore Map"
					onCta={() => goto('/')}
				/>
			</div>
		{:else}
			<!-- Favorites Grid -->
			<div class="favorites-grid">
				{#each favoriteLocations as site (site.est_id)}
					<div class="favorite-card">
						<div class="card-header">
							<h3 class="card-title">{site.name}</h3>
							<FavoriteButton estId={site.est_id} size="sm" />
						</div>

						<div class="card-body">
							<!-- Location Type -->
							<div class="card-detail">
								<span class="detail-label">Type:</span>
								<span class="detail-value">{site.type || 'Unknown'}</span>
							</div>

							<!-- Address if available -->
							{#if site.site?.address}
								<div class="card-detail">
									{#if browser}
										<MapPin weight="fill" size={12} class="detail-icon" />
									{/if}
									<span class="detail-value address">{site.site.address}</span>
								</div>
							{/if}

							<!-- Description -->
							{#if site.shortDescription}
								<p class="card-description">{site.shortDescription}</p>
							{/if}

							<!-- Quick Stats -->
							<div class="card-stats">
								{#if site.heatOverall}
									<div class="stat-badge">
										🌶️ Heat: {site.heatOverall}/10
									</div>
								{/if}
								{#if site.salsaCount}
									<div class="stat-badge">
										🥫 {site.salsaCount} Salsas
									</div>
								{/if}
							</div>
						</div>

						<div class="card-footer">
							<button class="view-button" on:click={() => viewOnMap(site)}>
								View on Map
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.favorites-container {
		min-height: calc(100vh - 66px);
		padding: 2rem 1rem;
		padding-top: 5rem; /* Account for fixed header */
		background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
		transition: background 0.3s ease;
	}

	/* Mobile: Less top padding */
	@media (max-width: 768px) {
		.favorites-container {
			padding-top: 4rem;
		}
	}

	:global(.dark) .favorites-container {
		background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
	}

	.favorites-content {
		width: 100%;
		box-sizing: border-box;
		max-width: 1200px;
		margin: 0 auto;
	}

	.favorites-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: 2rem;
	}

	/* Class lands on the icon component's <svg>, outside Svelte's scoping */
	.favorites-header :global(.header-icon) {
		color: var(--accent);
		margin-bottom: 1rem;
	}

	.favorites-title {
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.5rem;
	}

	:global(.dark) .favorites-title {
		color: #f9fafb;
	}

	.favorites-subtitle {
		font-size: 1rem;
		color: #6B7280;
	}

	:global(.dark) .favorites-subtitle {
		color: #9ca3af;
	}

	/* Empty state card surface */
	.empty-card {
		background: var(--surface-1);
		border-radius: 0.75rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	/* Favorites Grid */
	.favorites-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.favorite-card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
	}

	:global(.dark) .favorite-card {
		background: #1f2937;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
	}

	.favorite-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		border-bottom: 1px solid #E5E7EB;
	}

	:global(.dark) .card-header {
		border-bottom-color: #374151;
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
		flex: 1;
		line-height: 1.4;
	}

	:global(.dark) .card-title {
		color: #f9fafb;
	}

	.card-body {
		padding: 1.25rem;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-detail {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.detail-label {
		font-weight: 600;
		color: #374151;
	}

	:global(.dark) .detail-label {
		color: #d1d5db;
	}

	.detail-value {
		color: #6B7280;
	}

	:global(.dark) .detail-value {
		color: #9ca3af;
	}

	.detail-value.address {
		line-height: 1.4;
	}

	.card-detail :global(.detail-icon) {
		color: var(--accent);
		flex-shrink: 0;
	}

	.card-description {
		font-size: 0.875rem;
		color: #6B7280;
		line-height: 1.5;
		margin-top: 0.5rem;
	}

	:global(.dark) .card-description {
		color: #9ca3af;
	}

	.card-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.75rem;
	}

	.stat-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		background: #F3F4F6;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
	}

	:global(.dark) .stat-badge {
		background: #374151;
		color: #d1d5db;
	}

	.card-footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid #E5E7EB;
	}

	:global(.dark) .card-footer {
		border-top-color: #374151;
	}

	.view-button {
		width: 100%;
		padding: 0.75rem;
		background: #FE795D;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.view-button:hover {
		background: #d66548;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.favorites-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';

	// Props
	export let latitude = 32.2226; // Default to Tucson center
	export let longitude = -110.9747;
	export let onLocationChange = null; // Callback for when user drags marker

	let mapContainer;
	let map;
	let marker;

	onMount(() => {
		// Initialize map
		mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/streets-v12',
			center: [longitude, latitude],
			zoom: 14
		});

		// Add navigation controls
		map.addControl(new mapboxgl.NavigationControl(), 'top-right');

		// Create draggable marker
		marker = new mapboxgl.Marker({
			draggable: true,
			color: '#FE795D'
		})
			.setLngLat([longitude, latitude])
			.addTo(map);

		// Listen for marker drag events
		marker.on('dragend', () => {
			const lngLat = marker.getLngLat();
			latitude = lngLat.lat;
			longitude = lngLat.lng;

			// Notify parent component
			if (onLocationChange) {
				onLocationChange({
					latitude: lngLat.lat,
					longitude: lngLat.lng
				});
			}
		});

		// Cleanup on unmount
		return () => {
			map.remove();
		};
	});

	// Update marker position when props change (e.g., from geocoding)
	$: if (marker && latitude && longitude) {
		marker.setLngLat([longitude, latitude]);
		map.flyTo({ center: [longitude, latitude], zoom: 14 });
	}
</script>

<div class="location-picker">
	<div class="map-container" bind:this={mapContainer}></div>
	<p class="help-text">Drag the marker to adjust the exact location</p>
</div>

<style>
	.location-picker {
		width: 100%;
		margin: 1rem 0;
	}

	.map-container {
		width: 100%;
		height: 300px;
		border-radius: 8px;
		border: 2px solid #e5e7eb;
		overflow: hidden;
	}

	.help-text {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
		text-align: center;
	}

	/* Dark mode support */
	:global(.dark) .map-container {
		border-color: #374151;
	}

	:global(.dark) .help-text {
		color: #9ca3af;
	}
</style>

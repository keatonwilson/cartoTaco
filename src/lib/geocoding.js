/**
 * Mapbox Geocoding API integration
 * Converts addresses to coordinates for location submissions
 */

// Tucson, AZ coordinates for proximity bias
const TUCSON_CENTER = {
	longitude: -110.9747,
	latitude: 32.2226
};

/**
 * Geocode an address to coordinates using Mapbox Geocoding API
 * @param {string} address - Street address to geocode
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function geocodeAddress(address) {
	if (!address || address.trim().length === 0) {
		return { success: false, error: 'Address is required' };
	}

	try {
		const encodedAddress = encodeURIComponent(address.trim());
		const proximity = `${TUCSON_CENTER.longitude},${TUCSON_CENTER.latitude}`;

		// Build geocoding API URL
		// - Use mapbox.places for general geocoding
		// - Proximity biases results toward Tucson
		// - Limit to 5 results
		// - Restrict to US addresses
		const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${import.meta.env.VITE_MAPBOX_KEY}&proximity=${proximity}&limit=5&country=US`;

		const response = await fetch(url);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Geocoding API error:', response.status, errorText);
			return {
				success: false,
				error: `Geocoding failed: ${response.status} ${response.statusText}`
			};
		}

		const data = await response.json();

		// Check if any results were returned
		if (!data.features || data.features.length === 0) {
			return {
				success: false,
				error: 'Address not found. Please check the address and try again.'
			};
		}

		// Get the first (best) result
		const result = data.features[0];
		const [longitude, latitude] = result.center;

		// Extract formatted address
		const formattedAddress = result.place_name;

		// Check if result is reasonably close to Tucson (within ~50 miles / ~80km)
		const distance = calculateDistance(
			TUCSON_CENTER.latitude,
			TUCSON_CENTER.longitude,
			latitude,
			longitude
		);

		if (distance > 80) {
			return {
				success: false,
				error:
					'Address appears to be outside the Tucson area. CartoTaco currently only covers Tucson, AZ.'
			};
		}

		return {
			success: true,
			data: {
				latitude,
				longitude,
				formattedAddress,
				confidence: result.relevance || 1.0, // Mapbox relevance score (0-1)
				allResults: data.features.map((f) => ({
					address: f.place_name,
					latitude: f.center[1],
					longitude: f.center[0],
					relevance: f.relevance
				}))
			}
		};
	} catch (error) {
		console.error('Geocoding error:', error);
		return {
			success: false,
			error: 'Failed to geocode address. Please check your internet connection and try again.'
		};
	}
}

/**
 * Reverse geocode coordinates to an address
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<{ success: boolean, address?: string, error?: string }>}
 */
export async function reverseGeocode(latitude, longitude) {
	if (!latitude || !longitude) {
		return { success: false, error: 'Coordinates are required' };
	}

	try {
		const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${import.meta.env.VITE_MAPBOX_KEY}`;

		const response = await fetch(url);

		if (!response.ok) {
			return {
				success: false,
				error: `Reverse geocoding failed: ${response.status} ${response.statusText}`
			};
		}

		const data = await response.json();

		if (!data.features || data.features.length === 0) {
			return {
				success: false,
				error: 'No address found for these coordinates'
			};
		}

		const address = data.features[0].place_name;

		return {
			success: true,
			address
		};
	} catch (error) {
		console.error('Reverse geocoding error:', error);
		return {
			success: false,
			error: 'Failed to reverse geocode coordinates'
		};
	}
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371; // Earth's radius in km
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;

	return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees
 * @returns {number} Radians
 */
function toRad(degrees) {
	return (degrees * Math.PI) / 180;
}

/**
 * Validate that coordinates are within Tucson metro area
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {{ valid: boolean, error?: string }}
 */
export function isWithinTucsonArea(latitude, longitude) {
	if (!latitude || !longitude) {
		return { valid: false, error: 'Coordinates are required' };
	}

	// Rough bounding box for Tucson metro area
	const bounds = {
		north: 32.5,
		south: 31.8,
		east: -110.5,
		west: -111.2
	};

	if (latitude < bounds.south || latitude > bounds.north) {
		return { valid: false, error: 'Location is outside Tucson metro area (latitude)' };
	}

	if (longitude < bounds.west || longitude > bounds.east) {
		return { valid: false, error: 'Location is outside Tucson metro area (longitude)' };
	}

	return { valid: true };
}

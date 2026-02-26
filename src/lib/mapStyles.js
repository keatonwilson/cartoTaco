/**
 * Map style definitions for CartoTaco
 * Supports Mapbox styles and custom tile sources (Carto, Stamen)
 */

export const mapStyles = {
	// Standard Mapbox styles
	standard: {
		id: 'standard',
		name: 'Standard',
		description: 'Clean, modern map',
		type: 'mapbox',
		style: 'mapbox://styles/mapbox/standard',
		preview: null
	},

	dark: {
		id: 'dark',
		name: 'Dark',
		description: 'Dark theme for night viewing',
		type: 'mapbox',
		style: 'mapbox://styles/mapbox/dark-v11',
		preview: null
	},

	streets: {
		id: 'streets',
		name: 'Streets',
		description: 'Detailed street map',
		type: 'mapbox',
		style: 'mapbox://styles/mapbox/streets-v12',
		preview: null
	},

	// Carto artistic styles (free, no API key required)
	voyager: {
		id: 'voyager',
		name: 'Voyager',
		description: 'Colorful, playful style',
		type: 'raster',
		attribution: '© <a href="https://carto.com/">CARTO</a>',
		tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],
		tileSize: 256
	},

	positron: {
		id: 'positron',
		name: 'Positron',
		description: 'Light, minimal style',
		type: 'raster',
		attribution: '© <a href="https://carto.com/">CARTO</a>',
		tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
		tileSize: 256
	},

	darkMatter: {
		id: 'darkMatter',
		name: 'Dark Matter',
		description: 'Sleek dark style',
		type: 'raster',
		attribution: '© <a href="https://carto.com/">CARTO</a>',
		tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
		tileSize: 256
	}
};

/**
 * Build Mapbox GL style object for raster tile sources
 * @param {object} styleConfig - Style configuration from mapStyles
 * @returns {object} Mapbox GL style object
 */
export function buildRasterStyle(styleConfig) {
	return {
		version: 8,
		// Add glyphs for text rendering (required for labels)
		glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
		sources: {
			'raster-tiles': {
				type: 'raster',
				tiles: styleConfig.tiles,
				tileSize: styleConfig.tileSize,
				attribution: styleConfig.attribution
			}
		},
		layers: [
			{
				id: 'raster-layer',
				type: 'raster',
				source: 'raster-tiles',
				minzoom: 0,
				maxzoom: 22
			}
		]
	};
}

/**
 * Get Mapbox GL style for a given style ID
 * @param {string} styleId - Style ID from mapStyles
 * @returns {string|object} Mapbox style URL or style object
 */
export function getMapStyle(styleId) {
	const style = mapStyles[styleId];
	if (!style) {
		console.warn(`Unknown map style: ${styleId}, falling back to standard`);
		return mapStyles.standard.style;
	}

	if (style.type === 'mapbox') {
		return style.style;
	} else if (style.type === 'raster') {
		return buildRasterStyle(style);
	}

	return mapStyles.standard.style;
}

/**
 * Get list of available styles for picker
 * @returns {array} Array of style objects
 */
export function getAvailableStyles() {
	return Object.values(mapStyles);
}

/**
 * Get recommended styles based on theme
 * @param {string} theme - 'light' or 'dark'
 * @returns {array} Array of recommended style IDs
 */
export function getRecommendedStyles(theme) {
	if (theme === 'dark') {
		return ['dark', 'darkMatter', 'toner'];
	}
	return ['voyager', 'standard', 'watercolor'];
}

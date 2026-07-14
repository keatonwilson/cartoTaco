export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	darkMode: 'class',

	theme: {
		extend: {
			fontFamily: {
				// UI/body face — token-backed so components and Tailwind agree
				sans: ['Inter Variable', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
				// Headings, spot names, hero numbers
				display: ['Outfit Variable', 'Inter Variable', 'system-ui', 'sans-serif']
			},
			colors: {
				// Brand coral scale (kept literal — it's the source the CSS tokens mirror)
				primary: {
					50: '#FFF5F2',
					100: '#FFF1EE',
					200: '#FFE4DE',
					300: '#FFD5CC',
					400: '#FFBCAD',
					500: '#FE795D',
					600: '#EF562F',
					700: '#EB4F27',
					800: '#CC4522',
					900: '#A5371B'
				},
				// Semantic tokens — resolve to the CSS variables in app.css so
				// dark mode flips them without dark: variants
				surface: {
					1: 'var(--surface-1)',
					2: 'var(--surface-2)',
					3: 'var(--surface-3)'
				},
				ink: {
					1: 'var(--ink-1)',
					2: 'var(--ink-2)',
					3: 'var(--ink-3)'
				},
				line: {
					1: 'var(--line-1)',
					2: 'var(--line-2)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					hover: 'var(--accent-hover)',
					soft: 'var(--accent-soft)',
					contrast: 'var(--accent-contrast)'
				},
				pending: {
					DEFAULT: 'var(--pending)',
					soft: 'var(--pending-soft)'
				}
			}
		}
	},

	plugins: []
}

<script>
	// Salsa Atlas shell: the editorial typeface, the shared hexagon styles, and
	// view transitions between atlas pages. Fraunces is imported here rather
	// than in app.css so only these routes pay for it.
	import '@fontsource-variable/fraunces/opsz.css';
	import '@fontsource-variable/fraunces/opsz-italic.css';
	import { onNavigate } from '$app/navigation';

	// A hexagon and the detail page's hero share a view-transition-name, so the
	// browser morphs one into the other. No-op where unsupported.
	onNavigate((navigation) => {
		if (
			!document.startViewTransition ||
			!navigation.to?.url.pathname.startsWith('/salsa') ||
			// Re-clustering the index only changes ?by=; its own CSS moves the hexagons
			navigation.to.url.pathname === navigation.from?.url.pathname ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<div class="salsa-atlas">
	<slot />
</div>

<style>
	.salsa-atlas {
		--font-display: 'Fraunces Variable', Georgia, 'Times New Roman', serif;
		--font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		/* Corn yellow, a softer kernel of the logo's yellow, with inks dark
		   enough to read on it. Re-pointing the shared tokens here means every
		   atlas component picks the theme up without knowing about it. */
		--surface-1: #f3df52;
		--surface-2: #ecd33c;
		--surface-3: #e3c82f;
		--ink-1: #1c1814;
		--ink-2: #54450f;
		--ink-3: #6b5a16;
		--line-1: rgba(28, 24, 20, 0.16);
		--line-2: rgba(28, 24, 20, 0.38);
		--atlas-accent: #a8261c;
		flex: 1;
		background: var(--surface-1);
		color: var(--ink-1);
		font-family: var(--font-text);
		/* clip, not hidden: hidden would create a scrollport (see /compare) */
		overflow-x: clip;
	}

	/* Dark mode: toasted corn, with the logo yellow as the accent */
	:global(.dark) .salsa-atlas {
		--surface-1: #1c1814;
		--surface-2: #26201a;
		--surface-3: #322a21;
		--ink-1: #f6ecc4;
		--ink-2: #cdbd86;
		--ink-3: #a3956a;
		--line-1: rgba(240, 232, 30, 0.14);
		--line-2: rgba(240, 232, 30, 0.34);
		--atlas-accent: #f0e81e;
	}

	/* ── Honeycomb ──────────────────────────────────────────────────────────
	   Pointy-top hexagons. --cols sets how many fit across; the hexagon width
	   is derived from the container so a row always fits exactly. Every other
	   row is pushed half a hexagon right by the floated ::before, whose
	   shape-outside is a repeating band — no per-row markup or JS. */
	.salsa-atlas :global(.honeycomb) {
		--cols: 6;
		--m: 5px;
		container-type: inline-size;
		display: flex;
		width: 100%;
		max-width: 1080px;
		margin: 0 auto;
	}

	.salsa-atlas :global(.comb) {
		--s: calc(100cqw / (var(--cols) + 0.5) - 2 * var(--m) - 0.5px);
		--f: calc(1.732 * var(--s) + 4 * var(--m) - 1px);
		flex: 1;
		font-size: 0; /* swallow inline whitespace between cells */
		padding-bottom: calc(var(--s) * 0.2887);
	}

	.salsa-atlas :global(.comb::before) {
		content: '';
		width: calc(var(--s) / 2 + var(--m));
		float: left;
		height: 120%;
		shape-outside: repeating-linear-gradient(#0000 0 calc(var(--f) - 3px), #000 0 var(--f));
	}

	.salsa-atlas :global(.hex-cell) {
		position: relative;
		display: inline-block;
		vertical-align: top;
		width: var(--s);
		height: calc(var(--s) * 1.1547);
		margin: var(--m);
		margin-bottom: calc(var(--m) - var(--s) * 0.2887);
		font-size: 1rem;
		/* The cell is a rectangle; only the clipped hexagon inside takes hits */
		pointer-events: none;
		isolation: isolate;
		transition:
			transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 0.3s ease;
	}

	.salsa-atlas :global(.hex-cell.dimmed) {
		opacity: 0.16;
	}

	/* Shadow and focus ring are layers of their own, behind the salsa. */
	.salsa-atlas :global(.hex-cell::before),
	.salsa-atlas :global(.hex-cell::after) {
		content: '';
		position: absolute;
		z-index: -1;
		opacity: 0;
		transition:
			opacity 0.28s ease,
			transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	/* The shadow is an SVG image with the blur baked into it, in a box 30%
	   larger than the cell on every side (the viewBox padding) so the soft edge
	   has room. A CSS filter here got cropped to a rectangle in Chrome, and
	   clip-path can't be used at all: it is applied after filters. */
	.salsa-atlas :global(.hex-cell::before) {
		inset: -30%;
		background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-30 -30 160 160' preserveAspectRatio='none'%3E%3Cfilter id='b' x='-50%25' y='-50%25' width='200%25' height='200%25'%3E%3CfeGaussianBlur stdDeviation='8'/%3E%3C/filter%3E%3Cpolygon points='50,0 100,25 100,75 50,100 0,75 0,25' fill='%231c1814' filter='url(%23b)'/%3E%3C/svg%3E")
			center / 100% 100% no-repeat;
	}

	.salsa-atlas :global(.hex-cell::after) {
		inset: -5px;
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		background: var(--ink-1);
	}

	.salsa-atlas :global(.hex-cell:has(a:hover)),
	.salsa-atlas :global(.hex-cell:has(a:focus-visible)) {
		z-index: 2;
		opacity: 1;
		/* --px/--py are set by the hive's pointer handler; without them (touch,
		   keyboard, the small rows on detail pages) this is just the lift */
		transform: perspective(520px) rotateX(calc(var(--py, 0) * -22deg))
			rotateY(calc(var(--px, 0) * 22deg)) scale(1.12);
	}

	.salsa-atlas :global(.hex-cell:has(a:hover)::before) {
		opacity: 0.5;
		transform: translateY(10px);
	}

	.salsa-atlas :global(.hex-cell:has(a:focus-visible)::after) {
		opacity: 1;
	}

	@media (max-width: 900px) {
		.salsa-atlas :global(.honeycomb) {
			--cols: 4;
			--m: 4px;
		}
	}

	@media (max-width: 560px) {
		.salsa-atlas :global(.honeycomb) {
			--cols: 3;
			--m: 3px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.salsa-atlas :global(.hex-cell),
		.salsa-atlas :global(.hex-cell::before),
		.salsa-atlas :global(.hex-cell::after) {
			transition: none;
		}
		.salsa-atlas :global(.hex-cell:has(a:hover)) {
			transform: none;
		}
	}
</style>

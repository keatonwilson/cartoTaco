<script>
  // Salsa Atlas index: every salsa in the catalog as a hexagon, clustered into
  // a honeycomb by a feature the reader picks.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { processedTacoData, isLoading } from '$lib/stores';
  import { CLUSTER_MODES, clusterStyles, honeycombLayout, sortStyles, spotCounts, shortName } from '$lib/salsa';
  import SalsaHex from '../../components/SalsaHex.svelte';

  export let data;

  // The clustering lives in the URL (?by=colour) so it survives a visit to a
  // salsa's page and back, and can be shared
  $: by = $page.url.searchParams.get('by');
  $: mode = CLUSTER_MODES.some((m) => m.key === by) ? by : 'family';
  // Assumed until the hive is measured; the server renders the desktop layout
  let width = 1080;
  // Movement is animated only after the first measured layout has painted
  let ready = false;
  onMount(() => requestAnimationFrame(() => (ready = true)));

  const reduceMotion = browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero numbers count up once the spot data lands
  const foundTween = tweened(0, { duration: reduceMotion ? 0 : 900, easing: cubicOut });
  $: if (loaded) foundTween.set(found);

  // Segmented control: a thumb slides under the active option. It is placed
  // from the option's measured box, so it only exists once mounted.
  let pillEls = {};
  let thumb = '';
  function placeThumb() {
    const el = pillEls[mode];
    if (el) thumb = `left:${el.offsetLeft}px;width:${el.offsetWidth}px`;
  }
  $: mode, width, ready, placeThumb();

  // Pointer effects on the hive. The hexagon under the pointer learns where
  // the pointer is on it (--px/--py, each -0.5…0.5) and tilts toward it with a
  // highlight following; the hive glows in that salsa's colour beneath it.
  let hive;
  let litCell = null;
  function handlePointer(event) {
    const cell = event.target.closest?.('.hive-cell');
    if (cell !== litCell) {
      litCell?.style.removeProperty('--px');
      litCell?.style.removeProperty('--py');
      litCell = cell;
    }
    if (!cell) {
      hive.classList.remove('glow');
      return;
    }
    const box = cell.getBoundingClientRect();
    const hiveBox = hive.getBoundingClientRect();
    cell.style.setProperty('--px', ((event.clientX - box.left) / box.width - 0.5).toFixed(3));
    cell.style.setProperty('--py', ((event.clientY - box.top) / box.height - 0.5).toFixed(3));
    hive.style.setProperty('--glow-x', `${box.left + box.width / 2 - hiveBox.left}px`);
    hive.style.setProperty('--glow-y', `${box.top + box.height / 2 - hiveBox.top}px`);
    hive.style.setProperty('--glow-c', cell.dataset.colour);
    hive.classList.add('glow');
  }

  const LABEL_ROOM = 38; // px above the top row for its cluster labels
  const HEX_RATIO = 2 / Math.sqrt(3); // pointy-top height / width
  // How far the lattice backdrop extends past the hive (matches .hive::before inset)
  const LATTICE_BLEED_X = 16;
  const LATTICE_BLEED_Y = 40;

  $: styles = data.styles;
  // Spot data loads client-side; until it lands, hexagons show no count
  $: loaded = !$isLoading && $processedTacoData.length > 0;
  $: counts = spotCounts($processedTacoData);
  $: spectrum = sortStyles(styles, 'colour');
  $: found = styles.filter((s) => counts.get(s.slug)).length;
  $: hottest = sortStyles(styles, 'heat')[0];

  // Hexagon width and the gap between neighbours, by available width
  $: size = width >= 900 ? 92 : width >= 560 ? 84 : 76;
  $: unit = size + (width >= 560 ? 6 : 4);
  $: layout = honeycombLayout(clusterStyles(styles, mode, counts), Math.max(3, Math.floor(width / unit)));
  $: left = (width - ((layout.width - 1) * unit + size)) / 2;
  $: height = LABEL_ROOM + (layout.height - HEX_RATIO) * unit + size * HEX_RATIO;
  $: px = (pos) => ({ x: left + pos.x * unit, y: LABEL_ROOM + pos.y * unit });
  // Entrance order: hexagons pop in outward from the middle of the hive
  $: popDelay = (pos) => Math.round(Math.hypot(pos.x - (layout.width - 1) / 2, pos.y - layout.height / 2) * 70);

  // Faint outline of the empty lattice cells behind the hive, as a CSS mask so
  // it takes its colour from a theme token. One tile holds both row parities.
  $: lattice = (() => {
    const tileH = unit * Math.sqrt(3);
    const h = size * HEX_RATIO;
    const hex = (cx, cy) =>
      [[0, -0.5], [0.5, -0.25], [0.5, 0.25], [0, 0.5], [-0.5, 0.25], [-0.5, -0.25]]
        .map(([dx, dy]) => `${(cx + dx * size).toFixed(1)},${(cy + dy * h).toFixed(1)}`)
        .join(' ');
    const polys = [];
    for (const dx of [-unit, 0, unit]) {
      for (const dy of [-tileH, 0, tileH]) {
        polys.push(hex(size / 2 + dx, h / 2 + dy), hex(size / 2 + unit / 2 + dx, h / 2 + tileH / 2 + dy));
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${unit}" height="${tileH}">${polys
      .map((p) => `<polygon points="${p}" fill="none" stroke="#000" stroke-width="1.5"/>`)
      .join('')}</svg>`;
    const origin = px(layout.cells.values().next().value);
    return `--lattice:url('data:image/svg+xml,${encodeURIComponent(svg)}');--lattice-pos:${origin.x + LATTICE_BLEED_X}px ${origin.y + LATTICE_BLEED_Y}px`;
  })();
</script>

<svelte:head>
  <title>Salsa Atlas — CartoTaco</title>
  <meta
    name="description"
    content="A field guide to the salsas of Tucson's taco spots: ingredients, history, colours, and where to find each one."
  />
</svelte:head>

<header class="hero">
  <p class="kicker">CartoTaco · Tucson, Arizona</p>
  <h1><span>The</span> <span>Salsa</span> <span><em>Atlas</em></span></h1>
  <p class="lede">
    Every taco in Tucson is finished at the salsa bar. This is a field guide to
    {styles.length} salsas: what goes into each, where it comes from, the colours it comes in, and
    who serves it.
  </p>

  <dl class="facts">
    <div>
      <dt>Styles</dt>
      <dd>{styles.length}</dd>
    </div>
    <div>
      <dt>Found in Tucson</dt>
      <dd>{loaded ? Math.round($foundTween) : '–'}</dd>
    </div>
    {#if hottest}
      <div>
        <dt>Hottest</dt>
        <dd><a href="/salsa/{hottest.slug}">{shortName(hottest.name)}</a></dd>
      </div>
    {/if}
  </dl>
</header>

<!-- Every salsa's definitive colour, in hue order -->
<div class="spectrum" aria-hidden="true">
  {#each spectrum as s, i (s.slug)}
    <span style="background:{s.palette[0]};animation-delay:{250 + i * 30}ms"></span>
  {/each}
</div>

<section class="atlas">
  <nav class="controls" class:sliding={thumb} aria-label="Cluster by">
    <span class="control-label">Cluster by</span>
    {#if thumb}<span class="thumb" style={thumb} aria-hidden="true"></span>{/if}
    {#each CLUSTER_MODES as m}
      <a
        class="pill"
        bind:this={pillEls[m.key]}
        href={m.key === 'family' ? '/salsa' : `/salsa?by=${m.key}`}
        aria-current={mode === m.key ? 'true' : undefined}
        data-sveltekit-replacestate
        data-sveltekit-noscroll
        data-sveltekit-keepfocus
      >
        {m.label}
      </a>
    {/each}
  </nav>

  <div class="hive-wrap" bind:clientWidth={width}>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="hive"
      class:ready
      bind:this={hive}
      on:pointermove={handlePointer}
      on:pointerleave={handlePointer}
      style="height:{height}px;--s:{size}px;{lattice}"
    >
      {#each styles as style, i (style.slug)}
        {@const pos = px(layout.cells.get(style.slug))}
        <div
          class="hive-cell"
          data-colour={style.palette[0]}
          style="transform:translate({pos.x}px,{pos.y}px);transition-delay:{i * 14}ms"
        >
          <div class="hex-cell pop" style="animation-delay:{popDelay(layout.cells.get(style.slug))}ms">
            <SalsaHex {style} mini={size < 80} count={loaded ? counts.get(style.slug) || 0 : null} />
          </div>
        </div>
      {/each}
      {#each layout.labels as label (mode + label.key)}
        {@const pos = px(label)}
        <span class="hive-label" style="left:{pos.x + size / 2}px;top:{pos.y}px" in:fade={{ duration: 300, delay: 350 }}>
          {label.label}
        </span>
      {/each}
    </div>
  </div>

  <p class="legend">
    <span class="legend-swatch" aria-hidden="true"></span>
    Hatched salsas are in the atlas but not yet recorded at a Tucson spot.
    <a href="/submit">Know where to find one?</a>
  </p>
</section>

<style>
  .hero {
    max-width: 1080px;
    margin: 0 auto;
    padding: clamp(40px, 8vw, 96px) 20px clamp(28px, 4vw, 48px);
  }

  .kicker {
    margin: 0 0 clamp(14px, 2vw, 24px);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(3.4rem, 13vw, 10rem);
    font-weight: 400;
    line-height: 0.88;
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  /* Headline words rise in one after another on load… */
  h1 span {
    display: inline-block;
    animation: word-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  }

  h1 span:nth-child(2) {
    animation-delay: 0.09s;
  }

  h1 span:nth-child(3) {
    animation-delay: 0.18s;
  }

  @keyframes word-in {
    from {
      opacity: 0;
      transform: translateY(0.35em);
      filter: blur(10px);
    }
  }

  /* …and the whole hero recedes as the page scrolls it away */
  @supports (animation-timeline: scroll()) {
    @media (prefers-reduced-motion: no-preference) {
      .hero {
        animation: recede linear both;
        animation-timeline: scroll(root);
        animation-range: 80px 620px;
      }
    }
  }

  @keyframes recede {
    to {
      opacity: 0.15;
      transform: scale(0.94);
      filter: blur(5px);
    }
  }

  h1 em {
    font-weight: 300;
    color: var(--atlas-accent);
  }

  .lede {
    max-width: 34em;
    margin: clamp(20px, 3vw, 36px) 0 0;
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 2vw, 1.45rem);
    line-height: 1.45;
    color: var(--ink-1);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 12px clamp(24px, 5vw, 64px);
    margin: clamp(28px, 4vw, 48px) 0 0;
    padding-top: 18px;
    border-top: 1px solid var(--line-2);
  }

  .facts dt {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .facts dd {
    margin: 4px 0 0;
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 3.4vw, 2.4rem);
    line-height: 1;
    font-variant-numeric: lining-nums;
  }

  .facts a {
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.16em;
  }

  .facts a:hover {
    color: var(--atlas-accent);
  }

  .spectrum {
    display: flex;
    height: clamp(14px, 2.4vw, 28px);
  }

  .spectrum span {
    flex: 1;
    transform-origin: bottom;
    animation: stripe-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  }

  @keyframes stripe-in {
    from {
      transform: scaleY(0);
    }
  }

  .atlas {
    padding: clamp(24px, 4vw, 44px) 16px clamp(48px, 8vw, 96px);
  }

  /* Frosted-glass segmented control that rides along under the header while
     the hive is on screen */
  .controls {
    position: sticky;
    top: calc(var(--header-h, 64px) + 12px);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 2px;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto clamp(18px, 3vw, 30px);
    padding: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-1) 55%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(1.8);
    backdrop-filter: blur(18px) saturate(1.8);
    /* top-edge highlight is what makes it read as glass, not tinted film */
    box-shadow:
      inset 0 1.5px 0 rgba(255, 255, 255, 0.55),
      inset 0 0 0 1px rgba(255, 255, 255, 0.16),
      0 10px 28px rgba(28, 24, 20, 0.16);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .thumb {
    position: absolute;
    top: 5px;
    bottom: 5px;
    border-radius: 999px;
    background: var(--ink-1);
    transition:
      left 0.45s cubic-bezier(0.3, 1.3, 0.4, 1),
      width 0.45s cubic-bezier(0.3, 1.3, 0.4, 1);
  }

  .control-label {
    margin: 0 8px 0 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--ink-2);
  }

  .pill {
    position: relative;
    padding: 7px 14px;
    border: 0;
    border-radius: 999px;
    white-space: nowrap;
    background: transparent;
    color: var(--ink-1);
    font: 500 13px/1.2 var(--font-text);
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .pill:hover:not([aria-current]) {
    background: var(--line-1);
  }

  .pill[aria-current='true'] {
    background: var(--ink-1);
    color: var(--surface-1);
  }

  /* Once the thumb exists it carries the fill and slides between options */
  .sliding .pill[aria-current='true'] {
    background: transparent;
  }

  @media (prefers-reduced-transparency: reduce) {
    .controls {
      background: var(--surface-1);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }

  @media (max-width: 560px) {
    .control-label {
      display: none;
    }
  }

  .pill:focus-visible {
    outline: 2px solid var(--ink-1);
    outline-offset: 2px;
  }

  /* ── Hive ─────────────────────────────────────────────────────────────────
     Every hexagon is absolutely placed from honeycombLayout(), so switching
     the clustering just changes each one's translate and CSS animates it. */
  .hive-wrap {
    max-width: 1240px;
    margin: 0 auto;
  }

  .hive {
    position: relative;
    isolation: isolate;
  }

  /* Soft light in the hovered salsa's colour, under the hexagons */
  .hive::after {
    content: '';
    position: absolute;
    z-index: -1;
    left: var(--glow-x, 50%);
    top: var(--glow-y, 50%);
    width: calc(var(--s) * 6);
    aspect-ratio: 1;
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--glow-c, transparent), transparent);
    opacity: 0;
    transition:
      opacity 0.5s ease,
      left 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
      top 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }

  .hive:global(.glow)::after {
    opacity: 0.6;
  }

  /* Hexagons pop in outward from the middle on load. `backwards` only: a
     forwards fill would pin the transform and kill the hover tilt. */
  .pop {
    animation: pop 0.7s cubic-bezier(0.25, 1.5, 0.4, 1) backwards;
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.3);
    }
  }

  /* Empty lattice cells, fading out toward the edges so the hive has no box */
  .hive::before {
    content: '';
    position: absolute;
    inset: -40px -16px;
    background: var(--line-1);
    -webkit-mask-image: var(--lattice), radial-gradient(ellipse 62% 60% at 50% 50%, #000 45%, transparent 100%);
    mask-image: var(--lattice), radial-gradient(ellipse 62% 60% at 50% 50%, #000 45%, transparent 100%);
    -webkit-mask-position: var(--lattice-pos), center;
    mask-position: var(--lattice-pos), center;
    -webkit-mask-repeat: repeat, no-repeat;
    mask-repeat: repeat, no-repeat;
    -webkit-mask-composite: source-in;
    mask-composite: intersect;
    pointer-events: none;
  }

  .hive-cell {
    position: absolute;
    top: 0;
    left: 0;
  }

  .hive.ready .hive-cell {
    transition: transform 0.7s cubic-bezier(0.3, 0.9, 0.25, 1);
  }

  /* Each cell is its own stacking context (it has a transform), so the hovered
     one has to be lifted here or later cells paint over its shadow */
  .hive :global(.hive-cell:has(a:hover)),
  .hive :global(.hive-cell:has(a:focus-visible)) {
    z-index: 2;
  }

  .hive-cell .hex-cell {
    display: block;
    margin: 0;
  }

  .hive-label {
    position: absolute;
    z-index: 1;
    transform: translate(-50%, -100%);
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--ink-1);
    color: var(--surface-1);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .hive.ready .hive-cell,
    .thumb,
    .hive::after {
      transition: none;
    }

    .pop,
    h1 span,
    .spectrum span {
      animation: none;
    }
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    justify-content: center;
    margin: clamp(28px, 4vw, 44px) auto 0;
    font-size: 13px;
    color: var(--ink-2);
  }

  .legend a {
    color: var(--ink-1);
    text-underline-offset: 0.16em;
  }

  .legend-swatch {
    width: 18px;
    height: 18px;
    border: 1px solid var(--line-2);
    background: repeating-linear-gradient(135deg, transparent 0 4px, var(--ink-3) 4px 5px);
  }

</style>

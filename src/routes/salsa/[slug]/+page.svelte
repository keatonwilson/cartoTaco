<script>
  // One salsa: colour, ingredients, history, and the Tucson spots serving it.
  import { goto } from '$app/navigation';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import MapTrifold from 'phosphor-svelte/lib/MapTrifold';
  import { processedTacoData, isLoading, hasError, isOpenNow } from '$lib/stores';
  import { toast } from '$lib/toastStore';
  import { FAMILIES, inkFor, sortStyles, spotsForStyle, neighbours, shortName } from '$lib/salsa';
  import SalsaHex from '../../../components/SalsaHex.svelte';
  import SalsaArt from '../../../components/SalsaArt.svelte';
  import SalsaMap from '../../../components/SalsaMap.svelte';
  import FavoriteButton from '../../../components/FavoriteButton.svelte';
  import SalsaFavoriteButton from '../../../components/SalsaFavoriteButton.svelte';

  export let data;

  $: style = data.style;
  $: styles = data.styles;
  $: [c1, c2, c3] = style.palette;
  $: ink = inkFor(c1);
  $: family = FAMILIES.find((f) => f.key === style.family);

  // Prev/next walk the catalog in the index's default (family) order
  $: ordered = sortStyles(styles, 'family');
  $: index = ordered.findIndex((s) => s.slug === style.slug);
  $: prev = ordered[(index - 1 + ordered.length) % ordered.length];
  $: next = ordered[(index + 1) % ordered.length];
  $: related = neighbours(styles, style, 5);

  $: loaded = !$isLoading && $processedTacoData.length > 0;
  $: spots = spotsForStyle($processedTacoData, style.slug);
  $: openSpots = spots.filter((r) => !r.site.isClosed);

  const HEAT_STEPS = Array.from({ length: 10 }, (_, i) => i + 1);

  async function copyHex(hex) {
    try {
      await navigator.clipboard.writeText(hex);
      toast.success(`Copied ${hex}`);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  }

  function handleKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') goto(`/salsa/${prev.slug}`);
    if (event.key === 'ArrowRight') goto(`/salsa/${next.slug}`);
  }
</script>

<svelte:head>
  <title>{style.name} — Salsa Atlas — CartoTaco</title>
  <meta name="description" content="{style.name}: {style.tagline}" />
  <meta name="theme-color" content={c1} />
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<article style="--c1:{c1};--c2:{c2};--c3:{c3};--ink:{ink}">
  <header class="hero">
    <div class="hero-inner">
      <div class="hero-text">
        <a class="back" href="/salsa"><ArrowLeft size={14} weight="bold" /> Salsa Atlas</a>
        <p class="kicker">
          {[family?.label ?? style.family, style.origin].filter(Boolean).join(' · ')}
        </p>
        <h1>{style.name}</h1>
        <p class="tagline">{style.tagline}</p>

        {#if style.heat_min != null && style.heat_max != null}
          <div class="heat" role="img" aria-label="Typical heat {style.heat_min} to {style.heat_max} out of 10">
            <span class="heat-label">Heat</span>
            <span class="heat-track">
              {#each HEAT_STEPS as step}
                <span class:on={step >= style.heat_min && step <= style.heat_max}></span>
              {/each}
            </span>
            <span class="heat-value">{style.heat_min}–{style.heat_max}</span>
          </div>
        {/if}

        <div class="hero-actions">
          <SalsaFavoriteButton {style} />
        </div>
      </div>

      <figure class="hero-art">
        <div class="hero-hex" style="view-transition-name:salsa-{style.slug}">
          {#if style.img_url}
            <img src={style.img_url} alt={style.name} />
          {:else}
            <SalsaArt {style} />
          {/if}
        </div>
        {#if style.img_url && style.img_credit}
          <figcaption>Photo: {style.img_credit}</figcaption>
        {/if}
      </figure>
    </div>
  </header>

  <!-- Palette: each swatch is a button that copies its hex code -->
  <section class="palette" aria-label="Palette">
    {#each style.palette as hex, i}
      <button
        type="button"
        class="swatch"
        style="background:{hex};color:{inkFor(hex)};animation-delay:{120 + i * 80}ms"
        on:click={() => copyHex(hex)}
        aria-label="Copy {hex}"
      >
        <span class="swatch-role">{i === 0 ? 'Definitive' : `No. ${i + 1}`}</span>
        <span class="swatch-code">{hex}</span>
      </button>
    {/each}
  </section>

  <div class="body">
    <section class="ingredients reveal">
      <h2>What goes in</h2>
      <ol>
        {#each style.ingredients as ingredient}
          <li>{ingredient}</li>
        {/each}
      </ol>
    </section>

    {#if style.history}
      <section class="history reveal">
        <h2>Where it comes from</h2>
        <p>{style.history}</p>
      </section>
    {/if}
  </div>

  <section class="map reveal">
    <h2>Where it sits</h2>
    <p class="map-intro">
      Every salsa in the atlas, placed by two of its qualities. {shortName(style.name)} is ringed and
      joined to the four salsas closest to it across all six.
    </p>
    <SalsaMap {styles} {style} related={related.slice(0, 4)} />
  </section>

  <section class="spots reveal">
    <div class="spots-head">
      <h2>Where to find it</h2>
      {#if openSpots.length > 0}
        <a class="map-link" href="/?salsa={style.slug}">
          <MapTrifold size={16} weight="duotone" />
          Show {openSpots.length === 1 ? 'it' : `all ${openSpots.length}`} on the map
        </a>
      {/if}
    </div>

    {#if $hasError}
      <p class="spots-note">The spot list couldn't be loaded just now. Try again in a moment.</p>
    {:else if !loaded}
      <p class="spots-note">Checking the map…</p>
    {:else if spots.length === 0}
      <p class="spots-note">
        Not yet spotted in Tucson. If you know a place that serves it,
        <a href="/submit">tell us where</a>.
      </p>
    {:else}
      <ul class="spot-list">
        {#each spots as { site, link } (site.est_id)}
          <li class="reveal" class:closed={site.isClosed}>
            <a class="spot-main" href="/?location={site.est_id}">
              <span class="spot-name">{site.name}</span>
              <span class="spot-detail">
                {#if link.house_name}“{link.house_name}” · {/if}{site.type || 'Taco spot'}{#if link.note}
                  · {link.note}{/if}
              </span>
            </a>
            <span class="spot-side">
              {#if link.heat != null}
                <span class="spot-heat" title="This spot's version: heat {link.heat}/10">{link.heat}/10</span>
              {/if}
              {#if site.isClosed}
                <span class="status">Closed</span>
              {:else if isOpenNow(site.rawData?.hours)}
                <span class="status open">Open now</span>
              {/if}
              {#if !site.isClosed}
                <FavoriteButton estId={site.est_id} size="sm" />
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <nav class="more" aria-label="More salsas">
    <h2>Keep exploring</h2>
    <div class="honeycomb related">
      <div class="comb">
        {#each related as s (s.slug)}
          <div class="hex-cell"><SalsaHex style={s} mini /></div>
        {/each}
      </div>
    </div>

    <div class="pager">
      <a class="pager-link" href="/salsa/{prev.slug}" style="--p:{prev.palette[0]}">
        <span class="pager-dir"><ArrowLeft size={14} weight="bold" /> Previous</span>
        <span class="pager-name">{shortName(prev.name)}</span>
      </a>
      <a class="pager-link next" href="/salsa/{next.slug}" style="--p:{next.palette[0]}">
        <span class="pager-dir">Next <ArrowRight size={14} weight="bold" /></span>
        <span class="pager-name">{shortName(next.name)}</span>
      </a>
    </div>
    <p class="pager-hint">Use the ← and → keys to move between salsas.</p>
  </nav>
</article>

<style>
  h2 {
    margin: 0 0 clamp(14px, 2vw, 22px);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  /* ── Hero ─────────────────────────────────────────────────────────────── */
  .hero {
    position: relative;
    overflow: clip;
    background: var(--c1);
    color: var(--ink);
  }

  /* Slow-drifting light in the salsa's other colours. Kept to the art's side
     of the hero so the text keeps the contrast inkFor() picked against --c1. */
  .hero::before {
    content: '';
    position: absolute;
    inset: -20%;
    background:
      radial-gradient(34% 44% at 74% 38%, var(--c2), transparent 70%),
      radial-gradient(30% 40% at 92% 78%, var(--c3), transparent 70%);
    opacity: 0.6;
    filter: blur(30px);
    animation: drift 16s ease-in-out infinite alternate;
    pointer-events: none;
  }

  @keyframes drift {
    to {
      transform: translate(-5%, 4%) rotate(8deg) scale(1.12);
    }
  }

  .hero-inner {
    position: relative;
  }

  /* The bowl turns as the page scrolls */
  @supports (animation-timeline: scroll()) {
    @media (prefers-reduced-motion: no-preference) {
      .hero-hex :global(svg) {
        animation: turn linear both;
        animation-timeline: scroll(root);
        animation-range: 0 900px;
      }
    }
  }

  @keyframes turn {
    to {
      transform: rotate(70deg) scale(1.1);
    }
  }

  .hero-inner {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    align-items: center;
    gap: clamp(20px, 5vw, 64px);
    max-width: 1080px;
    margin: 0 auto;
    padding: clamp(28px, 6vw, 72px) 20px clamp(36px, 6vw, 80px);
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: clamp(20px, 4vw, 44px);
    color: inherit;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-decoration: none;
    opacity: 0.85;
  }

  .back:hover {
    opacity: 1;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .kicker {
    margin: 0 0 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.8rem, 9vw, 6.75rem);
    font-weight: 400;
    line-height: 0.92;
    letter-spacing: -0.035em;
    text-wrap: balance;
  }

  .tagline {
    max-width: 22em;
    margin: clamp(14px, 2vw, 24px) 0 0;
    font-family: var(--font-display);
    font-size: clamp(1.15rem, 2.2vw, 1.6rem);
    font-style: italic;
    font-weight: 300;
    line-height: 1.3;
  }

  .heat {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: clamp(22px, 3vw, 36px);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .heat-track {
    display: flex;
    gap: 3px;
  }

  .heat-track span {
    width: clamp(10px, 1.6vw, 16px);
    height: 18px;
    border: 1.5px solid currentColor;
    opacity: 0.4;
  }

  .heat-track span.on {
    background: currentColor;
    opacity: 1;
  }

  .hero-actions {
    margin-top: clamp(20px, 3vw, 32px);
  }

  .hero-art {
    margin: 0;
    justify-self: center;
    width: min(100%, 400px);
  }

  .hero-hex {
    aspect-ratio: 1 / 1.1547;
    display: grid;
    place-items: center;
    padding: 9%;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    background: var(--c3);
  }

  .hero-hex img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  figcaption {
    margin-top: 8px;
    font-size: 11px;
    text-align: center;
    opacity: 0.8;
  }

  /* ── Palette ──────────────────────────────────────────────────────────── */
  .palette {
    display: flex;
    min-height: clamp(110px, 16vw, 180px);
    overflow: clip;
    background: var(--c1);
  }

  .swatch {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
    min-width: 0;
    padding: 14px clamp(8px, 1.6vw, 18px);
    border: 0;
    text-align: left;
    cursor: copy;
    transition: flex-grow 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    /* swatches rise into place one after another on load */
    animation: swatch-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  }

  @keyframes swatch-in {
    from {
      transform: translateY(100%);
    }
  }

  .swatch:hover,
  .swatch:focus-visible {
    flex-grow: 1.7;
  }

  .swatch:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: -6px;
  }

  .swatch-role {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .swatch-code {
    font-family: var(--font-mono);
    font-size: clamp(12px, 1.7vw, 17px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ── Ingredients + history ────────────────────────────────────────────── */
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
    gap: clamp(32px, 6vw, 88px);
    max-width: 1080px;
    margin: 0 auto;
    padding: clamp(40px, 7vw, 96px) 20px;
  }

  .ingredients ol {
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: ingredient;
  }

  .ingredients li {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 11px 0;
    border-top: 1px solid var(--line-1);
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 1.8vw, 1.35rem);
    line-height: 1.25;
    counter-increment: ingredient;
  }

  .ingredients li:last-child {
    border-bottom: 1px solid var(--line-1);
  }

  .ingredients li::before {
    content: counter(ingredient, decimal-leading-zero);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-3);
  }

  .history p {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 1.7vw, 1.3rem);
    line-height: 1.6;
  }

  /* The drop cap is the one place body text takes the salsa's colour, so it
     sits on a block of that colour with its guaranteed-contrast ink. */
  .history p::first-letter {
    float: left;
    margin: 0.06em 0.12em 0 0;
    padding: 0.08em 0.14em;
    background: var(--c1);
    color: var(--ink);
    font-size: 3.6em;
    line-height: 0.82;
  }

  /* ── Map ──────────────────────────────────────────────────────────────── */
  .map {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 20px clamp(40px, 7vw, 96px);
  }

  .map-intro {
    max-width: 38em;
    margin: 0 0 clamp(16px, 2.4vw, 26px);
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 1.6vw, 1.25rem);
    line-height: 1.45;
  }

  /* ── Spots ────────────────────────────────────────────────────────────── */
  .spots {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 20px clamp(40px, 7vw, 96px);
  }

  .spots-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 20px;
    margin-bottom: clamp(14px, 2vw, 22px);
  }

  .spots-head h2 {
    margin: 0;
  }

  .map-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: 999px;
    background: var(--ink-1);
    color: var(--surface-1);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .map-link:hover {
    background: var(--atlas-accent);
    color: var(--surface-1);
  }

  .spots-note {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 1.8vw, 1.35rem);
    color: var(--ink-2);
  }

  .spots-note a {
    color: var(--ink-1);
    text-underline-offset: 0.16em;
  }

  .spot-list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 2px solid var(--ink-1);
  }

  .spot-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid var(--line-1);
  }

  .spot-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 16px 0;
    color: inherit;
    text-decoration: none;
  }

  .spot-name {
    font-family: var(--font-display);
    font-size: clamp(1.3rem, 2.6vw, 1.9rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .spot-main:hover .spot-name {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.14em;
  }

  .spot-detail {
    font-size: 13px;
    color: var(--ink-2);
  }

  .closed .spot-name {
    color: var(--ink-2);
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }

  .spot-side {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .spot-heat,
  .status {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .status.open {
    color: var(--success);
  }

  /* ── More ─────────────────────────────────────────────────────────────── */
  .more {
    padding: clamp(36px, 6vw, 72px) 20px clamp(48px, 8vw, 96px);
    border-top: 1px solid var(--line-1);
    background: var(--surface-2);
  }

  .more h2,
  .pager,
  .pager-hint {
    max-width: 1080px;
    margin-left: auto;
    margin-right: auto;
  }

  /* Five across on desktop, with the comb sized so they sit in one row */
  .more .related {
    --cols: 5;
    max-width: 760px;
  }

  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: clamp(28px, 4vw, 48px);
  }

  .pager-link {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px 20px;
    border: 1px solid var(--line-2);
    border-left: 10px solid var(--p);
    background: var(--surface-1);
    color: inherit;
    text-decoration: none;
    transition: border-color 0.15s ease;
  }

  .pager-link.next {
    align-items: flex-end;
    border-left: 1px solid var(--line-2);
    border-right: 10px solid var(--p);
    text-align: right;
  }

  .pager-link:hover {
    border-color: var(--ink-1);
    border-left-color: var(--p);
  }

  .pager-link.next:hover {
    border-left-color: var(--ink-1);
    border-right-color: var(--p);
  }

  .pager-dir {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .pager-name {
    font-family: var(--font-display);
    font-size: clamp(1.3rem, 3vw, 2.1rem);
    line-height: 1.05;
  }

  .pager-hint {
    margin-top: 14px;
    font-size: 12px;
    color: var(--ink-3);
  }

  /* ── Motion: sections rise in as they enter the viewport ──────────────── */
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      .reveal {
        animation: rise linear both;
        animation-timeline: view();
        animation-range: entry 0% entry 40%;
      }
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(28px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .swatch {
      transition: none;
      animation: none;
    }

    .hero::before {
      animation: none;
    }
  }

  @media (hover: none) {
    .pager-hint {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .hero-inner,
    .body {
      grid-template-columns: minmax(0, 1fr);
    }

    .hero-art {
      width: min(64%, 260px);
      justify-self: start;
    }

    .back {
      margin-bottom: 18px;
    }

    .more .related {
      --cols: 3;
    }
  }
</style>

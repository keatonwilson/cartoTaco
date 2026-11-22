<script>
  // One salsa as a hexagon, filled with its definitive colour; the lower tip
  // carries its second and third palette colours. Fills its parent, which must
  // be a `.hex-cell` (sized by the honeycomb styles in routes/salsa/+layout).
  import { inkFor, shortName } from '$lib/salsa';

  export let style;
  /** Open spots serving it; null while spot data is still loading */
  export let count = null;
  /** Name only — for the small neighbour rows */
  export let mini = false;

  $: [c1, c2, c3] = style.palette;
  $: label =
    count == null
      ? style.name
      : count === 0
        ? `${style.name}, not yet spotted in Tucson`
        : `${style.name}, ${count} ${count === 1 ? 'spot' : 'spots'}`;
</script>

<a
  class="hex"
  class:unspotted={count === 0}
  class:mini
  href="/salsa/{style.slug}"
  aria-label={label}
  style="--c1:{c1};--c2:{c2};--c3:{c3};--ink:{inkFor(c1)};view-transition-name:salsa-{style.slug}"
>
  <span class="name">{shortName(style.name)}</span>
  {#if !mini}
    <span class="meta">
      <span class="code">{c1}</span>
      <span class="count">
        {#if count === 0}not yet spotted{:else if count != null}{count} {count === 1 ? 'spot' : 'spots'}{/if}
      </span>
    </span>
  {/if}
  <span class="tip" aria-hidden="true"></span>
</a>

<style>
  .hex {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(var(--s) * 0.035);
    padding: 0 11%;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    background: var(--c1);
    color: var(--ink);
    text-align: center;
    text-decoration: none;
    pointer-events: auto;
    outline: none; /* focus ring is drawn by .hex-cell (clip-path eats outlines) */
    -webkit-tap-highlight-color: transparent;
  }

  .name {
    font-family: var(--font-display);
    font-size: max(12px, calc(var(--s) * 0.135));
    font-weight: 500;
    line-height: 1.04;
    letter-spacing: -0.015em;
    text-wrap: balance;
  }

  /* Highlight that follows the pointer (--px/--py from the hive), like light
     catching a glossy tile */
  .hex::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at calc(50% + var(--px, 0) * 100%) calc(50% + var(--py, 0) * 100%),
      rgba(255, 255, 255, 0.5),
      transparent 55%
    );
    mix-blend-mode: soft-light;
    opacity: 0;
    transition: opacity 0.25s ease;
    pointer-events: none;
  }

  .hex:hover::before {
    opacity: 1;
  }

  /* Hex code and spot count share one line and swap on hover */
  .meta {
    position: relative;
    display: grid;
    font-family: var(--font-mono);
    font-size: max(9px, calc(var(--s) * 0.066));
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.78;
  }

  .code,
  .count {
    grid-area: 1 / 1;
    transition: opacity 0.2s ease;
  }

  .count {
    opacity: 0;
  }

  .hex:hover .code,
  .hex:focus-visible .code {
    opacity: 0;
  }

  .hex:hover .count,
  .hex:focus-visible .count {
    opacity: 1;
  }

  /* No hover on touch: the count is more use than the code there */
  @media (hover: none) {
    .code {
      opacity: 0;
    }
    .count {
      opacity: 1;
    }
  }

  /* The lower triangle of the hexagon, split into the 2nd and 3rd colours */
  .tip {
    position: absolute;
    inset: auto 0 0;
    height: 25%;
    background: linear-gradient(90deg, var(--c2) 50%, var(--c3) 50%);
  }

  /* In the catalog but not yet recorded at any Tucson spot */
  .unspotted::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      135deg,
      transparent 0 7px,
      color-mix(in srgb, var(--ink) 20%, transparent) 7px 8px
    );
    pointer-events: none;
  }

  .mini .name {
    font-size: max(11px, calc(var(--s) * 0.15));
  }

  @media (prefers-reduced-motion: reduce) {
    .code,
    .count {
      transition: none;
    }
  }
</style>

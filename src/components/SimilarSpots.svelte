<script>
  // "Similar spots" on the card: the open spots whose hand-written
  // descriptions read most like this one's (site_similarity, computed by
  // cartoTacoMenuExtract). Renders nothing until the scores exist, so the
  // section appears on its own the first time the script has run.
  import { onMount } from 'svelte';
  import { processedTacoData } from '$lib/stores';
  import { similarityIndex, loadSimilarity } from '$lib/similarityStore';
  import { similarSpots } from '$lib/similarity';
  import { mapInstance } from '$lib/mapStore';
  import { flyToSite } from '$lib/mapping';

  /** @type {number} */
  export let estId;
  /** A closed spot gets "if you miss this one" framing */
  export let closed = false;

  const TYPE_LABELS = { 'Brick and Mortar': 'Restaurant', Stand: 'Stand', Truck: 'Food truck' };

  onMount(() => { loadSimilarity(); });

  $: spots = similarSpots($similarityIndex, estId, $processedTacoData, 3);

  function open(site) {
    if ($mapInstance) flyToSite($mapInstance, site);
  }
</script>

{#if spots.length > 0}
  <section class="card-section" style="--i:6">
    <h3 class="card-label">{closed ? 'If you miss this one' : 'Similar spots'}</h3>
    <ul class="similar-list">
      {#each spots as { site } (site.est_id)}
        <li>
          <button type="button" class="similar-item" on:click={() => open(site)}>
            <span class="similar-name">{site.name}</span>
            <span class="similar-meta">{TYPE_LABELS[site.type] || site.type}{#if site.rawData?.descriptions?.region} · {site.rawData.descriptions.region}{/if}</span>
            {#if site.shortDescription}
              <span class="similar-blurb">{site.shortDescription}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    <p class="similar-note">Matched on how their descriptions read.</p>
  </section>
{/if}

<style>
  /* Same band as Card's sections (Card's styles are scoped, so repeated here) */
  .card-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 0;
    border-top: 1px solid var(--line-1);
    animation: similar-in 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }

  @keyframes similar-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-section {
      animation: none;
    }
  }

  .card-label {
    margin: 0;
    font: 600 12px/1.3 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .similar-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .similar-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    text-align: left;
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: 10px;
    color: var(--ink-1);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .similar-item:hover,
  .similar-item:focus-visible {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .similar-name {
    font: 600 16px/1.25 var(--font-serif);
  }

  .similar-meta {
    font-size: 12px;
    color: var(--ink-2);
  }

  .similar-blurb {
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .similar-note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-3, var(--ink-2));
  }
</style>

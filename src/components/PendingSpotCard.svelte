<script>
  // Preliminary card for pending (unvetted) spots — web-scraped entries the
  // team hasn't visited yet. Deliberately lightweight: no radar, heat ladder,
  // salsa lineup, vibe votes, or compare. Shares HoursOpen/ContactInfo/
  // FavoriteButton with the full Card.
  import Info from 'phosphor-svelte/lib/Info';
  import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
  import HoursOpen from './HoursOpen.svelte';
  import ContactInfo from './ContactInfo.svelte';
  import FavoriteButton from './FavoriteButton.svelte';
  import { selectedSite } from '$lib/stores';

  // Matches the prop mapping.js passes to popup cards; unused (reads selectedSite)
  export let siteId = null;

  $: site = $selectedSite;
  $: region = site?.rawData?.descriptions?.region || null;
  $: hasHours = (site?.startHours || []).some(([, v]) => v);
  $: hasContact = !!(
    site?.site?.phone ||
    site?.site?.website ||
    site?.site?.instagram ||
    site?.site?.facebook ||
    site?.site?.address
  );
  $: sourceHost = (() => {
    if (!site?.sourceUrl) return null;
    try {
      return new URL(site.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return site.sourceUrl;
    }
  })();
</script>

{#if !site}
  <div class="pending-card"><p class="empty">No location selected</p></div>
{:else}
  <div class="pending-card">
    <div class="header-row">
      <span class="pending-badge">◌ Pending vetting</span>
      <FavoriteButton estId={site.est_id} size="sm" />
    </div>

    <h2 class="spot-name">{site.name || 'Unknown Location'}</h2>
    {#if site.type || region}
      <p class="spot-meta">
        {[site.type, region].filter(Boolean).join(' · ')}
      </p>
    {/if}

    <div class="info-panel">
      <span class="info-icon"><Info size={18} weight="bold" /></span>
      <p>
        We found this spot online but haven't visited yet. Details may be
        incomplete or out of date.
      </p>
    </div>

    {#if site.shortDescription}
      <p class="description">{site.shortDescription}</p>
    {/if}

    {#if hasHours}
      <div class="section">
        <HoursOpen startHours={site.startHours || {}} endHours={site.endHours || {}} />
      </div>
    {/if}

    {#if hasContact || (site.latitude && site.longitude)}
      <div class="section">
        <ContactInfo
          phone={site.site?.phone}
          website={site.site?.website}
          instagram={site.site?.instagram}
          facebook={site.site?.facebook}
          address={site.site?.address}
          latitude={site.latitude}
          longitude={site.longitude}
          name={site.name || 'Taco Location'}
        />
      </div>
    {/if}

    <div class="footer">
      {#if sourceHost}
        <a class="source-link" href={site.sourceUrl} target="_blank" rel="noopener noreferrer">
          Source: {sourceHost}
          <ArrowSquareOut size={12} weight="bold" />
        </a>
      {/if}
      <a class="vet-cta" href="/submit">Been here? Tell us about it →</a>
    </div>
  </div>
{/if}

<style>
  .pending-card {
    background: var(--surface-1);
    border: 1.5px dashed var(--pending);
    border-radius: 12px;
    padding: 14px 16px 12px;
    max-width: 480px;
    margin: 0 auto;
  }

  .empty {
    color: var(--ink-2);
    text-align: center;
    padding: 12px 0;
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .pending-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--pending-soft);
    color: var(--ink-2);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }

  .spot-name {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--ink-1);
    margin: 8px 0 0;
    line-height: 1.25;
  }

  .spot-meta {
    color: var(--ink-2);
    font-size: 0.85rem;
    margin: 2px 0 0;
  }

  .info-panel {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--pending-soft);
    border-radius: 8px;
    padding: 10px 12px;
    margin: 12px 0;
  }

  .info-icon {
    color: var(--pending);
    flex-shrink: 0;
    display: flex;
    margin-top: 1px;
  }

  .info-panel p {
    color: var(--ink-2);
    font-size: 0.85rem;
    line-height: 1.45;
    margin: 0;
  }

  .description {
    color: var(--ink-1);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0 0 12px;
  }

  .section {
    margin-bottom: 12px;
  }

  .footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--line-1);
    padding-top: 10px;
    margin-top: 4px;
  }

  .source-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ink-3);
    font-size: 0.75rem;
    text-decoration: none;
    width: fit-content;
  }

  .source-link:hover {
    color: var(--ink-2);
    text-decoration: underline;
  }

  .vet-cta {
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    width: fit-content;
  }

  .vet-cta:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }
</style>

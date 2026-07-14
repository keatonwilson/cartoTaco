<script>
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { processedTacoData, isLoading } from '$lib/stores.js';
  import { supabaseBrowser } from '$lib/supabaseBrowser.js';

  const MIN_SPOTS = 2;
  const MAX_SPOTS = 6;

  let title = '';
  let searchText = '';
  let selectedIds = new Set();
  let creating = false;
  let errorMsg = '';

  // Filter spots by search text. Pending (unvetted) spots are excluded —
  // voting on a spot with no data makes no sense.
  $: filtered = $processedTacoData.filter(s => {
    if (s.isPending) return false;
    if (!searchText.trim()) return true;
    return s.name.toLowerCase().includes(searchText.toLowerCase());
  });

  $: selectedCount = selectedIds.size;
  $: canCreate = selectedCount >= MIN_SPOTS && selectedCount <= MAX_SPOTS && !creating;

  function toggleSpot(estId) {
    const next = new Set(selectedIds);
    if (next.has(estId)) {
      next.delete(estId);
    } else if (next.size < MAX_SPOTS) {
      next.add(estId);
    }
    selectedIds = next;
  }

  async function createSummit() {
    if (!canCreate || !browser) return;
    creating = true;
    errorMsg = '';

    // Generate a random creator token stored in localStorage
    const creatorToken = crypto.randomUUID();
    const sessionTitle = title.trim() || 'Taco Summit';
    const siteIds = Array.from(selectedIds);

    const { data, error } = await supabaseBrowser
      .from('group_sessions')
      .insert({ creator_token: creatorToken, site_ids: siteIds, title: sessionTitle })
      .select('id')
      .single();

    if (error || !data) {
      errorMsg = 'Could not create summit. Please try again.';
      creating = false;
      return;
    }

    // Persist creator token so this browser can close the session
    localStorage.setItem(`summit_creator_${data.id}`, creatorToken);
    goto(`/vote/${data.id}`);
  }
</script>

<div class="page">
  <div class="container">
    <!-- Back -->
    <button class="back-btn" on:click={() => goto('/')}>&larr; Back to Map</button>

    <h1 class="page-title">Start a Taco Summit</h1>
    <p class="page-subtitle">
      Pick 2–6 spots, share the link with your crew, and let everyone rank their favourites.
      The app tallies the votes and reveals the winner.
    </p>

    <!-- Title input -->
    <div class="field">
      <label for="summit-title" class="label">Summit name (optional)</label>
      <input
        id="summit-title"
        type="text"
        class="text-input"
        placeholder="e.g. Friday Night Tacos"
        maxlength="60"
        bind:value={title}
      />
    </div>

    <!-- Spot selector -->
    <div class="field">
      <div class="spots-header">
        <label class="label" for="spot-search">
          Choose spots
          <span class="count-badge" class:maxed={selectedCount >= MAX_SPOTS}>
            {selectedCount}/{MAX_SPOTS}
          </span>
        </label>
        <input
          id="spot-search"
          type="search"
          class="search-input"
          placeholder="Search by name…"
          bind:value={searchText}
        />
      </div>

      {#if $isLoading}
        <div class="status">Loading spots…</div>
      {:else if filtered.length === 0}
        <div class="status">No spots match "{searchText}"</div>
      {:else}
        <ul class="spot-list">
          {#each filtered as site (site.est_id)}
            {@const checked = selectedIds.has(site.est_id)}
            {@const disabled = !checked && selectedCount >= MAX_SPOTS}
            <li>
              <button
                class="spot-row"
                class:checked
                class:disabled
                disabled={disabled}
                on:click={() => toggleSpot(site.est_id)}
                aria-pressed={checked}
              >
                <span class="checkbox" aria-hidden="true">{checked ? '✓' : ''}</span>
                <span class="spot-name">{site.name}</span>
                <span class="spot-type">{site.type}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if errorMsg}
      <div class="error">{errorMsg}</div>
    {/if}

    {#if selectedCount < MIN_SPOTS}
      <p class="hint">Select at least {MIN_SPOTS} spots to continue.</p>
    {/if}

    <button class="create-btn" disabled={!canCreate} on:click={createSummit}>
      {creating ? 'Creating…' : 'Create Summit & Get Link'}
    </button>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 2rem 1rem 4rem;
    background: var(--bg, #f9fafb);
  }

  :global(.dark) .page {
    background: #0a0e1a;
  }

  .container {
    max-width: 560px;
    margin: 0 auto;
  }

  .back-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;
    margin-bottom: 1.5rem;
  }

  .back-btn:hover { color: #FE795D; }

  :global(.dark) .back-btn { color: #9ca3af; }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 0.5rem;
  }

  :global(.dark) .page-title { color: #f9fafb; }

  .page-subtitle {
    font-size: 0.9rem;
    color: #6b7280;
    margin: 0 0 2rem;
    line-height: 1.6;
  }

  :global(.dark) .page-subtitle { color: #9ca3af; }

  .field {
    margin-bottom: 1.5rem;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  :global(.dark) .label { color: #d1d5db; }

  .count-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    background: #e5e7eb;
    color: #374151;
    font-variant-numeric: tabular-nums;
  }

  .count-badge.maxed {
    background: rgba(254, 121, 93, 0.18);
    color: #FE795D;
  }

  :global(.dark) .count-badge {
    background: #374151;
    color: #d1d5db;
  }

  .text-input,
  .search-input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem; /* 16px min prevents iOS Safari auto-zoom on focus */
    background: white;
    color: #111827;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  .text-input:focus,
  .search-input:focus {
    outline: none;
    border-color: #FE795D;
    box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.15);
  }

  :global(.dark) .text-input,
  :global(.dark) .search-input {
    background: #1f2937;
    border-color: #374151;
    color: #f9fafb;
  }

  .spots-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .spots-header .label { margin-bottom: 0; }

  .search-input {
    width: auto;
    flex: 1;
    min-width: 160px;
    max-width: 240px;
    padding: 0.4rem 0.7rem;
    font-size: 0.85rem;
  }

  .spot-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    max-height: 360px;
    overflow-y: auto;
  }

  :global(.dark) .spot-list { border-color: #374151; }

  .spot-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.7rem 1rem;
    background: white;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }

  :global(.dark) .spot-row {
    background: #1f2937;
    border-bottom-color: #374151;
  }

  .spot-row:last-child { border-bottom: none; }

  .spot-row:hover:not(.disabled) { background: #fef3f0; }
  :global(.dark) .spot-row:hover:not(.disabled) { background: rgba(254, 121, 93, 0.08); }

  .spot-row.checked { background: rgba(254, 121, 93, 0.08); }
  :global(.dark) .spot-row.checked { background: rgba(254, 121, 93, 0.15); }

  .spot-row.disabled { opacity: 0.4; cursor: not-allowed; }

  .checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    color: white;
    background: white;
    flex-shrink: 0;
    transition: all 0.12s;
  }

  .spot-row.checked .checkbox {
    background: #FE795D;
    border-color: #FE795D;
  }

  :global(.dark) .checkbox {
    border-color: #4b5563;
    background: #111827;
  }

  .spot-name {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 500;
    color: #111827;
  }

  :global(.dark) .spot-name { color: #f9fafb; }

  .spot-type {
    font-size: 0.72rem;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .status {
    padding: 1.5rem;
    text-align: center;
    color: #9ca3af;
    font-size: 0.875rem;
    font-style: italic;
  }

  .hint {
    font-size: 0.8rem;
    color: #9ca3af;
    margin: 0 0 1rem;
  }

  .error {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  :global(.dark) .error {
    background: rgba(220, 38, 38, 0.12);
    border-color: rgba(220, 38, 38, 0.4);
    color: #f87171;
  }

  .create-btn {
    width: 100%;
    padding: 0.875rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .create-btn:hover:not(:disabled) { background: #EF562F; }
  .create-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>

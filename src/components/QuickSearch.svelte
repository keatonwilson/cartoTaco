<script>
  // Quick Search: a ⌘K / "/" palette for jumping straight to a spot. Ranked,
  // typo-tolerant results on every keystroke (src/lib/search.js), a "Filter
  // the map" row when the query reads as filters (src/lib/intentRules.js),
  // and voice input where the browser has speech recognition. No model, no
  // network: everything runs over the spots already in the stores.
  import { onDestroy, tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
  import Microphone from 'phosphor-svelte/lib/Microphone';
  import Funnel from 'phosphor-svelte/lib/Funnel';
  import X from 'phosphor-svelte/lib/X';
  import { processedTacoData, filterConfig, flyToTarget, isLoading } from '$lib/stores';
  import { matchesFilters } from '$lib/siteModel';
  import { favoriteIds } from '$lib/favoritesStore';
  import { searchSpots } from '$lib/search';
  import { parseIntent, applyIntentFilters } from '$lib/intentRules';
  import { listen, speechSupported, describeVoiceError, isAppleMobile } from '$lib/voice';
  import { getOpenStatus, minuteClock } from '$lib/hours';
  import { quickSearchOpen, filterPanelOpen } from '$lib/uiStore';

  const LIMIT = 8;
  const TYPE_LABELS = { 'Brick and Mortar': 'Restaurant', Stand: 'Stand', Truck: 'Food truck' };
  const FIELD_LABELS = {
    specialty: 'Specialty',
    style: 'Serves',
    protein: 'Serves',
    menu: 'Menu',
    region: 'Style',
    address: 'Address',
    description: 'About'
  };

  let query = '';
  let active = 0;
  let inputEl;
  let listEl;
  let canSpeak = false;
  let listening = false;
  let stopListening = null;
  let voiceError = null;

  // iPhone/iPad get no mic of ours (see speechSupported); point them at the
  // keyboard's dictation key instead
  let dictateHint = false;
  $: if (browser) {
    canSpeak = speechSupported();
    dictateHint = isAppleMobile();
  }

  $: placeholder = listening
    ? 'Listening…'
    : dictateHint
      ? 'Search, or tap 🎤 on the keyboard'
      : 'Search spots, dishes, or “spicy pork open now”';

  // ── What the query means ──
  $: intent = parseIntent(query);
  $: hasFilters = Object.keys(intent.filters).length > 0 || intent.extras.handmadeTortillas;
  $: filterLabels = intent.matched.filter((label) => !label.startsWith('Near '));
  // The map's filters with this query's applied over them (search text cleared:
  // the palette's own results already cover the words)
  $: intentConfig = hasFilters
    ? applyIntentFilters({ ...$filterConfig, searchText: '' }, intent.filters)
    : null;

  $: candidates = intentConfig
    ? $processedTacoData.filter((s) =>
        matchesFilters(s, intentConfig, $favoriteIds, $minuteClock) &&
        (!intent.extras.handmadeTortillas || s.handmadeTortilla))
    : $processedTacoData;

  $: results = intent.remainder || !hasFilters
    ? searchSpots(hasFilters ? intent.remainder : query, candidates, { limit: LIMIT })
    : candidates
        .filter((s) => !s.isClosed)
        .slice(0, LIMIT)
        .map((site) => ({ site, matchedOn: null }));

  // Rows the arrow keys move through: the filter row (when there is one), then spots
  $: rows = [...(hasFilters ? [{ kind: 'filter' }] : []), ...results.map((r) => ({ kind: 'spot', ...r }))];
  $: if (active >= rows.length) active = Math.max(0, rows.length - 1);

  // ── Opening and closing ──
  $: if ($quickSearchOpen) onOpen();

  async function onOpen() {
    await tick();
    inputEl?.focus();
    inputEl?.select();
  }

  function close() {
    stopVoice();
    quickSearchOpen.set(false);
    voiceError = null;
  }

  function isTyping(target) {
    const tag = target?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
  }

  function handleGlobalKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      quickSearchOpen.update((open) => !open);
      return;
    }
    if (e.key === '/' && !$quickSearchOpen && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      quickSearchOpen.set(true);
    }
  }

  // Handled on the dialog so Escape here never also closes the map's open spot
  function handleDialogKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = rows.length ? (active + 1) % rows.length : 0;
      scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = rows.length ? (active - 1 + rows.length) % rows.length : 0;
      scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rows[active]) choose(rows[active]);
    }
  }

  async function scrollActiveIntoView() {
    await tick();
    listEl?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function onInput() {
    active = 0;
  }

  // ── Acting on a row ──
  function choose(row) {
    if (row.kind === 'filter') applyFilters();
    else openSpot(row.site);
  }

  function openSpot(site) {
    close();
    query = '';
    if ($page.url.pathname === '/') flyToTarget.set(site);
    else goto(`/?location=${site.est_id}`);
  }

  function applyFilters() {
    filterConfig.set(intentConfig);
    filterPanelOpen.set(true);
    close();
    query = '';
    if ($page.url.pathname !== '/') goto('/');
  }

  // ── Voice ──
  // Each mic tap is a new session. Callbacks from an older one (aborted when
  // this one started) are ignored, so they can't flip this one's state.
  let voiceSession = 0;

  function toggleVoice() {
    if (listening) {
      stopVoice();
      return;
    }
    const session = ++voiceSession;
    const isCurrent = () => session === voiceSession;
    voiceError = null;
    listening = true;
    stopListening = listen({
      onResult: (text) => {
        if (!isCurrent() || !text) return;
        query = text;
        active = 0;
      },
      onError: (code) => {
        if (isCurrent()) voiceError = describeVoiceError(code);
      },
      onEnd: () => {
        if (!isCurrent()) return;
        listening = false;
        stopListening = null;
      }
    });
  }

  function stopVoice() {
    const stop = stopListening;
    voiceSession++;
    stopListening = null;
    listening = false;
    stop?.();
  }

  onDestroy(stopVoice);

  function statusFor(site) {
    if (site.isClosed) return { state: 'closed', label: 'Permanently closed' };
    return getOpenStatus(site.startHours || [], site.endHours || [], $minuteClock);
  }

  function why(matchedOn) {
    if (!matchedOn || matchedOn.field === 'name' || matchedOn.field === 'type') return null;
    return `${FIELD_LABELS[matchedOn.field] || 'Match'}: ${matchedOn.label}`;
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

{#if $quickSearchOpen}
  <div class="qs-backdrop" transition:fade={{ duration: 120 }} on:click={close} aria-hidden="true"></div>

  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="qs-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Search spots"
    transition:fly={{ y: -8, duration: 150 }}
    on:keydown={handleDialogKeydown}
  >
    <div class="qs-input-row">
      {#if browser}<MagnifyingGlass size={20} class="qs-icon" />{/if}
      <input
        bind:this={inputEl}
        bind:value={query}
        on:input={onInput}
        type="text"
        {placeholder}
        aria-label="Search spots"
        role="combobox"
        aria-expanded={rows.length > 0}
        aria-controls="qs-results"
        aria-activedescendant={rows.length ? `qs-row-${active}` : undefined}
        autocomplete="off"
        spellcheck="false"
      />
      {#if canSpeak}
        <button
          class="qs-mic"
          class:listening
          on:click={toggleVoice}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Search by voice'}
          title={listening ? 'Stop listening' : 'Search by voice'}
        >
          {#if browser}<Microphone size={18} weight={listening ? 'fill' : 'regular'} />{/if}
        </button>
      {/if}
      <button class="qs-close" on:click={close} aria-label="Close search">
        {#if browser}<X size={18} />{/if}
      </button>
    </div>

    {#if voiceError}
      <p class="qs-note" role="status">{voiceError}</p>
    {/if}

    <ul class="qs-results" id="qs-results" role="listbox" bind:this={listEl}>
      {#each rows as row, i (row.kind === 'filter' ? 'filter' : row.site.est_id)}
        <li
          id="qs-row-{i}"
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          on:click={() => choose(row)}
          on:keydown={() => {}}
          on:mousemove={() => (active = i)}
        >
          {#if row.kind === 'filter'}
            <span class="qs-filter-icon">{#if browser}<Funnel size={16} weight="duotone" />{/if}</span>
            <span class="qs-main">
              <span class="qs-name">Filter the map</span>
              <span class="qs-chips">
                {#each filterLabels as label}<span class="qs-chip">{label}</span>{/each}
              </span>
            </span>
            <span class="qs-count">{candidates.length} {candidates.length === 1 ? 'spot' : 'spots'}</span>
          {:else}
            {@const status = statusFor(row.site)}
            <span class="qs-dot" data-state={status.state} aria-hidden="true"></span>
            <span class="qs-main">
              <span class="qs-name">
                {#if row.site.isClosed}<span class="qs-mark" title="Permanently closed">✕</span>{/if}
                {#if row.site.isPending}<span class="qs-mark" title="Pending: not yet vetted">◌</span>{/if}
                {row.site.name}
              </span>
              <span class="qs-meta">
                {TYPE_LABELS[row.site.type] || row.site.type || 'Spot'} · {status.label}
                {#if why(row.matchedOn)}<span class="qs-why"> · {why(row.matchedOn)}</span>{/if}
              </span>
            </span>
          {/if}
        </li>
      {/each}
    </ul>

    {#if rows.length === 0}
      <p class="qs-empty">
        {#if $isLoading}
          Loading spots…
        {:else if query.trim()}
          No spots match “{query.trim()}”.
        {:else}
          Type a spot, a dish (birria, al pastor), or what you’re after: “spicy pork open now, no trucks”.
        {/if}
      </p>
    {/if}

    <div class="qs-footer" aria-hidden="true">
      <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>esc</kbd> close</span>
    </div>
  </div>
{/if}

<style>
  .qs-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 10001;
  }

  .qs-dialog {
    position: fixed;
    top: calc(var(--header-h, 64px) + 24px);
    left: 50%;
    transform: translateX(-50%);
    width: min(600px, calc(100vw - 32px));
    max-height: min(70vh, 560px);
    display: flex;
    flex-direction: column;
    background: var(--surface-1);
    color: var(--ink-1);
    border: 1px solid var(--line-1);
    border-radius: 14px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
    z-index: 10002;
    overflow: hidden;
    font-family: var(--font-text);
  }

  .qs-input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line-1);
  }

  .qs-input-row :global(.qs-icon) {
    color: var(--ink-3);
    flex-shrink: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--ink-1);
    font-size: 1.05rem;
  }

  input::placeholder {
    color: var(--ink-3);
  }

  .qs-mic,
  .qs-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }

  .qs-close {
    border-color: transparent;
  }

  .qs-mic:hover,
  .qs-close:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .qs-mic.listening {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
    animation: qs-pulse 1.2s ease-in-out infinite;
  }

  @keyframes qs-pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-soft); }
    50% { box-shadow: 0 0 0 6px var(--accent-soft); }
  }

  @media (prefers-reduced-motion: reduce) {
    .qs-mic.listening { animation: none; }
  }

  .qs-note {
    margin: 0;
    padding: 8px 16px;
    font-size: 0.8rem;
    color: var(--ink-2);
    background: var(--surface-2);
  }

  .qs-results {
    list-style: none;
    margin: 0;
    padding: 6px;
    overflow-y: auto;
  }

  .qs-results li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
  }

  .qs-results li.active {
    background: var(--accent-soft);
  }

  .qs-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .qs-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .qs-meta {
    font-size: 0.8rem;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .qs-why {
    color: var(--ink-3);
  }

  .qs-mark {
    color: var(--ink-3);
    margin-right: 2px;
  }

  .qs-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--ink-3);
  }

  .qs-dot[data-state='open'] { background: var(--success); }
  .qs-dot[data-state='closing-soon'] { background: var(--warning); }
  .qs-dot[data-state='closed'],
  .qs-dot[data-state='opens-later'] { background: var(--closed); }

  .qs-filter-icon {
    display: flex;
    color: var(--accent);
  }

  .qs-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .qs-chip {
    font-size: 0.75rem;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--line-1);
    color: var(--ink-2);
  }

  .qs-count {
    font-size: 0.8rem;
    color: var(--ink-3);
    white-space: nowrap;
  }

  .qs-empty {
    margin: 0;
    padding: 18px 16px;
    font-size: 0.9rem;
    color: var(--ink-2);
  }

  .qs-footer {
    display: flex;
    gap: 14px;
    padding: 8px 14px;
    border-top: 1px solid var(--line-1);
    font-size: 0.75rem;
    color: var(--ink-3);
  }

  kbd {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0 4px;
    margin-right: 2px;
    border: 1px solid var(--line-1);
    border-radius: 4px;
  }

  /* Phones: a full-screen sheet, and no keyboard hints */
  @media (max-width: 640px) {
    .qs-dialog {
      top: 0;
      left: 0;
      transform: none;
      width: 100vw;
      height: 100dvh;
      max-height: none;
      border-radius: 0;
      border: none;
    }

    .qs-footer {
      display: none;
    }

    .qs-results li {
      padding: 12px;
    }
  }
</style>

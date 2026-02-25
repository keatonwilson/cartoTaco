<script>
  import { createEventDispatcher } from 'svelte';
  import { BellOutline } from 'flowbite-svelte-icons';
  import { recentlyAddedSites } from '$lib/stores';
  import { unseenNewSpotsCount, markNewSpotsAsSeen } from '$lib/newSpotsStore';
  import { mapInstance } from '$lib/mapStore';
  import { flyToSite } from '$lib/mapping';
  import { isMobile } from '$lib/deviceDetection';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let containerEl;

  // Portal action: moves the node to document.body so that position:fixed
  // is relative to the viewport, not the header (which has backdrop-filter).
  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function closeDropdown() {
    isOpen = false;
  }

  function handleWindowClick(event) {
    if (isOpen && !$isMobile && containerEl && !containerEl.contains(event.target)) {
      closeDropdown();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && isOpen) {
      closeDropdown();
    }
  }

  function handleSpotClick(site) {
    if ($mapInstance) {
      flyToSite($mapInstance, site);
    }
    closeDropdown();
    dispatch('spotSelected');
  }

  function handleMarkAsSeen() {
    markNewSpotsAsSeen();
    closeDropdown();
  }

  // Format date for display (e.g., "2 days ago", "Today")
  function formatDate(dateStr) {
    const created = new Date(dateStr);
    const now = new Date();
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    return created.toLocaleDateString();
  }
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

<div class="new-spots-container" bind:this={containerEl}>
  <button
    class="bell-button"
    on:click={toggleDropdown}
    aria-label="New establishments"
    title={$unseenNewSpotsCount > 0 ? `${$unseenNewSpotsCount} new spot${$unseenNewSpotsCount !== 1 ? 's' : ''}` : 'No new spots'}
  >
    <BellOutline size="lg" />
    {#if $unseenNewSpotsCount > 0}
      <span class="badge">{$unseenNewSpotsCount}</span>
    {/if}
  </button>

  {#if isOpen}
    <!-- Desktop/Tablet: Dropdown panel -->
    {#if !$isMobile}
      <div class="dropdown-panel">
        <div class="panel-header">
          <h3 class="panel-title">New Spots</h3>
          <button class="close-button" on:click={closeDropdown} aria-label="Close">×</button>
        </div>

        {#if $recentlyAddedSites.length === 0}
          <p class="empty-message">No new establishments yet</p>
        {:else}
          <div class="spots-list">
            {#each $recentlyAddedSites as spot (spot.est_id)}
              <button
                class="spot-item"
                on:click={() => handleSpotClick(spot)}
              >
                <div class="spot-info">
                  <div class="spot-name">{spot.name}</div>
                  <div class="spot-meta">
                    <span class="spot-type">{spot.type}</span>
                    <span class="spot-date">{formatDate(spot.createdAt)}</span>
                  </div>
                </div>
                <span class="arrow">→</span>
              </button>
            {/each}
          </div>

          {#if $unseenNewSpotsCount > 0}
            <div class="panel-footer">
              <button class="mark-seen-button" on:click={handleMarkAsSeen}>
                Mark all as seen
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {:else}
      <!-- Mobile: Full-width panel (portalled to body to escape header's backdrop-filter containing block) -->
      <div
        class="mobile-panel-overlay"
        use:portal
        on:click={closeDropdown}
        role="button"
        tabindex="-1"
        aria-label="Close panel"
      >
        <div class="mobile-panel" on:click|stopPropagation>
          <div class="panel-header">
            <h3 class="panel-title">New Spots</h3>
            <button class="close-button" on:click={closeDropdown} aria-label="Close">×</button>
          </div>

          {#if $recentlyAddedSites.length === 0}
            <p class="empty-message">No new establishments yet</p>
          {:else}
            <div class="spots-list">
              {#each $recentlyAddedSites as spot (spot.est_id)}
                <button
                  class="spot-item"
                  on:click={() => handleSpotClick(spot)}
                >
                  <div class="spot-info">
                    <div class="spot-name">{spot.name}</div>
                    <div class="spot-meta">
                      <span class="spot-type">{spot.type}</span>
                      <span class="spot-date">{formatDate(spot.createdAt)}</span>
                    </div>
                  </div>
                  <span class="arrow">→</span>
                </button>
              {/each}
            </div>

            {#if $unseenNewSpotsCount > 0}
              <div class="panel-footer">
                <button class="mark-seen-button" on:click={handleMarkAsSeen}>
                  Mark all as seen
                </button>
              </div>
            {/if}
          {/if}

          <div class="mobile-panel-close-bar">
            <button class="mobile-close-button" on:click={closeDropdown}>
              Close
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .new-spots-container {
    position: relative;
  }

  .bell-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: #FE795D;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .bell-button:hover {
    color: #EF562F;
  }

  /* Badge with unseen count */
  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #FE795D;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
    border: 2px solid white;
  }

  /* Desktop/Tablet: Dropdown panel */
  .dropdown-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 320px;
    max-width: 400px;
    max-height: 500px;
    display: flex;
    flex-direction: column;
  }

  :global(.dark) .dropdown-panel {
    background: #1f2937;
    border-color: #374151;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  /* Mobile: Full-width overlay panel
     These are :global because the elements are portalled to document.body
     and live outside Svelte's scoped DOM subtree. */
  :global(.mobile-panel-overlay) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    cursor: pointer;
  }

  :global(.mobile-panel) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: 1rem 1rem 0 0;
    height: 80vh;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    z-index: 10000;
  }

  :global(.dark .mobile-panel) {
    background: #1f2937;
  }

  /* Panel header */
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #E5E7EB;
  }

  :global(.dark) .panel-header {
    border-color: #374151;
  }

  .panel-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1F2937;
  }

  :global(.dark) .panel-title {
    color: #F3F4F6;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6B7280;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .close-button:hover {
    color: #1F2937;
  }

  :global(.dark) .close-button:hover {
    color: #F3F4F6;
  }

  /* Empty state */
  .empty-message {
    padding: 2rem 1rem;
    text-align: center;
    color: #6B7280;
    font-size: 0.875rem;
  }

  :global(.dark) .empty-message {
    color: #9CA3AF;
  }

  /* Spots list */
  .spots-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .spot-item {
    width: 100%;
    padding: 0.75rem;
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
  }

  .spot-item:hover {
    background: #F3F4F6;
    border-color: #FE795D;
  }

  :global(.dark) .spot-item {
    background: #374151;
    border-color: #4B5563;
  }

  :global(.dark) .spot-item:hover {
    background: #4B5563;
    border-color: #FE795D;
  }

  .spot-info {
    flex: 1;
    min-width: 0;
  }

  .spot-name {
    font-weight: 600;
    color: #1F2937;
    font-size: 0.9375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.dark) .spot-name {
    color: #F3F4F6;
  }

  .spot-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6B7280;
    margin-top: 0.25rem;
  }

  :global(.dark) .spot-meta {
    color: #9CA3AF;
  }

  .spot-type {
    background: #FEE2DD;
    color: #FE795D;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  :global(.dark) .spot-type {
    background: rgba(254, 121, 93, 0.2);
    color: #FECACA;
  }

  .spot-date {
    white-space: nowrap;
  }

  .arrow {
    margin-left: 0.5rem;
    color: #FE795D;
    font-weight: bold;
  }

  /* Panel footer */
  .panel-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid #E5E7EB;
  }

  :global(.dark) .panel-footer {
    border-color: #374151;
  }

  .mark-seen-button {
    width: 100%;
    padding: 0.5rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .mark-seen-button:hover {
    background: #EF562F;
  }

  /* Mobile close bar */
  .mobile-panel-close-bar {
    padding: 0.75rem 1rem;
    border-top: 1px solid #E5E7EB;
  }

  :global(.dark) .mobile-panel-close-bar {
    border-color: #374151;
  }

  .mobile-close-button {
    width: 100%;
    padding: 0.75rem;
    background: transparent;
    color: #6B7280;
    border: 1px solid #E5E7EB;
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mobile-close-button:active {
    background: #F3F4F6;
  }

  :global(.dark) .mobile-close-button {
    color: #9CA3AF;
    border-color: #4B5563;
  }

  :global(.dark) .mobile-close-button:active {
    background: #374151;
  }

</style>

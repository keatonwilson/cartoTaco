<script>
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { browser } from '$app/environment';

  export let title;
  export let defaultOpen = false;
  export let icon = null;

  // State management with localStorage persistence
  let isOpen = defaultOpen;

  // Load saved state from localStorage
  if (browser && title) {
    const storageKey = `collapsible-${title.replace(/\s+/g, '-').toLowerCase()}`;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      isOpen = saved === 'true';
    }
  }

  function toggle() {
    isOpen = !isOpen;

    // Save state to localStorage
    if (browser && title) {
      const storageKey = `collapsible-${title.replace(/\s+/g, '-').toLowerCase()}`;
      localStorage.setItem(storageKey, isOpen.toString());
    }
  }
</script>

<div class="collapsible-section">
  <button
    class="collapsible-header"
    on:click={toggle}
    aria-expanded={isOpen}
  >
    {#if icon}
      <span class="icon">{icon}</span>
    {/if}
    <span class="title">{title}</span>
    <svg
      class="chevron"
      class:rotated={isOpen}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>

  {#if isOpen}
    <div
      class="collapsible-content"
      transition:slide={{ duration: 300, easing: quintOut }}
    >
      <slot />
    </div>
  {/if}
</div>

<style>
  .collapsible-section {
    margin-bottom: 12px;
  }

  .collapsible-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    /* Touch-optimized: 44px minimum tap target */
    min-height: 44px;
    padding: 12px 16px;
    background-color: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s, box-shadow 0.2s;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    text-align: left;
  }

  :global(.dark) .collapsible-header {
    background-color: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .collapsible-header:hover {
    background-color: #e9ecef;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  :global(.dark) .collapsible-header:hover {
    background-color: #4b5563;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .collapsible-header:active {
    background-color: #dee2e6;
  }

  :global(.dark) .collapsible-header:active {
    background-color: #6b7280;
  }

  .icon {
    margin-right: 8px;
    font-size: 18px;
  }

  .title {
    flex: 1;
  }

  .chevron {
    width: 20px;
    height: 20px;
    transition: transform 0.3s ease;
    flex-shrink: 0;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .collapsible-content {
    padding: 12px 0;
    overflow: hidden;
  }
</style>

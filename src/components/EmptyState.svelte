<script>
  // Shared empty state with a little personality (U4 of the UI refresh).
  export let emoji = '🌮';
  export let title = 'Nothing here yet';
  export let message = '';
  /** Optional CTA — renders a button when both are provided */
  export let ctaLabel = null;
  export let onCta = null;
</script>

<div class="empty-state">
  <span class="empty-emoji" aria-hidden="true">{emoji}</span>
  <h3 class="empty-title">{title}</h3>
  {#if message}
    <p class="empty-message">{message}</p>
  {/if}
  {#if ctaLabel && onCta}
    <button class="empty-cta" on:click={onCta}>{ctaLabel}</button>
  {/if}
  <slot />
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    padding: 2.5rem 1.25rem;
  }

  .empty-emoji {
    font-size: 40px;
    line-height: 1;
    filter: grayscale(0.15);
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--ink-1);
    margin: 4px 0 0;
  }

  .empty-message {
    font-size: 13px;
    color: var(--ink-2);
    margin: 0;
    max-width: 340px;
    line-height: 1.45;
  }

  .empty-cta {
    margin-top: 10px;
    padding: 8px 18px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .empty-cta:hover {
    background: var(--accent-hover);
  }
</style>

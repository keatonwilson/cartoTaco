<script>
  // Where a description's facts come from: one work per line, the author (or
  // publisher) linked to the page, then the title. Used by chat answers and spot cards.

  /** @type {Array<{ by: string, title?: string, url?: string|null }>} */
  export let items = [];
</script>

{#if items.length}
  <div class="sources">
    <span class="label">Sources</span>
    <ul>
      {#each items as s}
        <li>
          {#if s.url}<a href={s.url} target="_blank" rel="noopener noreferrer" on:click|stopPropagation>{s.by}</a>{:else}{s.by}{/if}{#if s.title && s.title !== s.by}<span class="title"> · {s.title}</span>{/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .sources {
    margin-top: 6px;
    font-size: 0.74rem;
    line-height: 1.35;
    color: var(--ink-3);
    white-space: normal;
    text-align: left;
  }

  .label {
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  ul {
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
  }

  li {
    margin: 1px 0;
    overflow-wrap: anywhere;
  }

  a {
    color: var(--ink-2);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .title {
    font-style: italic;
  }
</style>

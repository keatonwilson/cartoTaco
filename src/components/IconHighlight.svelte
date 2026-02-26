<script>
  import { effectiveTheme } from '$lib/theme';

  export let data;
  export let type;

  const highlightCorn = data === "both" || data === "corn";
  const highlightFlour = data === "both" || data === "flour";

  $: p = $effectiveTheme === 'dark' ? 'dark_' : '';
</script>

<div class="icons" class:tortilla-icons={type === "tortilla"}>
  {#if type === "siteType"}
    <div class="icon-wrapper">
      <img
        src="/{p}shop_icon.svg"
        alt="Taco Shop"
        class:highlight={data === "Brick and Mortar"}
        class="icon site-icon"
      />
      <span class="tooltip">Restaurant</span>
    </div>
    <div class="icon-wrapper">
      <img
        src="/{p}stand_icon.svg"
        alt="Taco Stand"
        class:highlight={data === "Stand"}
        class="icon site-icon"
      />
      <span class="tooltip">Stand</span>
    </div>
    <div class="icon-wrapper">
      <img
        src="/{p}truck_icon.svg"
        alt="Taco Truck"
        class:highlight={data === "Truck"}
        class="icon site-icon"
      />
      <span class="tooltip">Food Truck</span>
    </div>
  {:else if type === "tortilla"}
    <div class="icon-wrapper">
      <img
        src="/{p}corn.svg"
        alt="Corn"
        class:highlight={highlightCorn}
        class="icon tortilla-icon"
      />
      <span class="tooltip">Corn Tortillas</span>
    </div>
    <div class="icon-wrapper">
      <img
        src="/{p}wheat.svg"
        alt="Wheat"
        class:highlight={highlightFlour}
        class="icon tortilla-icon"
      />
      <span class="tooltip">Flour Tortillas</span>
    </div>
  {/if}
</div>

<style>
  .icons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-top: 6px;
    margin-bottom: 8px;
  }

  @media (min-width: 1024px) {
    .icons {
      justify-content: space-between;
      gap: 0;
    }
  }

  .tortilla-icons {
    justify-content: center;
    gap: 10px;
  }

  /* Wrapper holds icon + tooltip together */
  .icon-wrapper {
    position: relative;
    display: flex;
    justify-content: center;
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    bottom: calc(100% + 5px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 30, 0.85);
    color: #fff;
    font-size: 10px;
    font-weight: 500;
    padding: 3px 7px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  :global(.dark) .tooltip {
    background: rgba(250, 250, 250, 0.9);
    color: #111;
  }

  .icon-wrapper:hover .tooltip {
    opacity: 1;
  }

  .site-icon {
    width: 38px;
    height: 38px;
    opacity: 0.3;
  }

  .tortilla-icon {
    width: 32px;
    height: 32px;
    max-width: 32px;
    max-height: 32px;
    object-fit: contain;
    flex-shrink: 0;
    opacity: 0.3;
  }

  .icon.highlight {
    opacity: 1;
  }
</style>

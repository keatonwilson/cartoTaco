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
    <img
      src="/{p}shop_icon.svg"
      alt="Taco Shop"
      class:highlight={data === "Brick and Mortar"}
      class="icon site-icon"
    />
    <img
      src="/{p}stand_icon.svg"
      alt="Taco Stand"
      class:highlight={data === "Stand"}
      class="icon site-icon"
    />
    <img
      src="/{p}truck_icon.svg"
      alt="Taco Truck"
      class:highlight={data === "Truck"}
      class="icon site-icon"
    />
  {:else if type === "tortilla"}
    <img
      src="/{p}corn.svg"
      alt="Corn"
      class:highlight={highlightCorn}
      class="icon tortilla-icon"
    />
    <img
      src="/{p}wheat.svg"
      alt="Wheat"
      class:highlight={highlightFlour}
      class="icon tortilla-icon"
    />
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

  .site-icon {
    width: 38px;
    height: 38px;
    opacity: 0.3;
  }

  .tortilla-icons {
    justify-content: center;
    gap: 10px;
  }

  .tortilla-icon {
    width: 32px;
    height: 32px;
    max-width: 32px;
    max-height: 32px;
    object-fit: contain;
    flex-shrink: 0;
    opacity: 0.3; /* Default faded */
  }

  .icon.highlight {
    opacity: 1; /* Highlighted icon */
  }
</style>

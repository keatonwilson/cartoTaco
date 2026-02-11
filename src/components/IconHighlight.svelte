<script>
  export let data;
  export let type;

  const highlightCorn = data === "both" || data === "corn";
  const highlightFlour = data === "both" || data === "flour";

</script>

<div class="icons" class:tortilla-icons={type === "tortilla"}>
  {#if type === "siteType"}
    <img
      src="/shop_icon.svg"
      alt="Taco Shop"
      class:highlight={data === "Brick and Mortar"}
      class="icon site-icon"
    />
    <img
      src="/stand_icon.svg"
      alt="Taco Stand"
      class:highlight={data === "Stand"}
      class="icon site-icon"
    />
    <img
      src="/truck_icon.svg"
      alt="Taco Truck"
      class:highlight={data === "Truck"}
      class="icon site-icon"
    />
  {:else if type === "tortilla"}
    <img
      src="/corn.svg"
      alt="Corn"
      class:highlight={highlightCorn}
      class="icon tortilla-icon"
    />
    <img
      src="/wheat.svg"
      alt="Wheat"
      class:highlight={highlightFlour}
      class="icon tortilla-icon"
    />
  {/if}
</div>

<style>
  .icons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
    margin-bottom: 16px;
  }

  /* Default styling for site-type icons */
  .site-icon {
    width: 50px;
    height: 50px;
    opacity: 0.3; /* Default faded */
  }

  /* Specific styling for tortilla icons - smaller and contained */
  .tortilla-icons {
    justify-content: center;
    gap: 12px;
  }

  .tortilla-icon {
    width: 40px;
    height: 40px;
    max-width: 40px;
    max-height: 40px;
    object-fit: contain;
    flex-shrink: 0;
    opacity: 0.3; /* Default faded */
  }

  .icon.highlight {
    opacity: 1; /* Highlighted icon */
  }
</style>

<script>
  export let data;
  export let type;

  const highlightCorn = data === "both" || data === "corn";
  const highlightFlour = data === "both" || data === "flour";

</script>

<div class="icons">
  {#if type === "siteType"}
    <img
      src="/shop_icon.svg"
      alt="Taco Shop"
      class:highlight={data === "Brick and Mortar"}
      class="icon"
    />
    <img
      src="/stand_icon.svg"
      alt="Taco Stand"
      class:highlight={data === "Stand"}
      class="icon"
    />
    <img
      src="/truck_icon.svg"
      alt="Taco Truck"
      class:highlight={data === "Truck"}
      class="icon"
    />
  {:else if type === "tortilla"}
    <img
      src="/corn.svg"
      alt="Corn"
      class:highlight={highlightCorn}
      class="icon"
    />
    <img
      src="/wheat.svg"
      alt="Wheat"
      class:highlight={highlightFlour}
      class="icon"
    />
  {/if}
</div>

<style>
  .icons {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }

  .icon {
    width: 50px;
    height: 50px;
    opacity: 0.3; /* Default faded */
  }

  .icon.highlight {
    opacity: 1; /* Highlighted icon */
  }
</style>

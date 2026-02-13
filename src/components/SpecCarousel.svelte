<script>
  import { onMount } from 'svelte';
  import SpecCard from './SpecCard.svelte';

  export let specialties = [];

  let currentIndex = 0;
  let carouselContainer;

  // Update pagination dots when scrolling
  function handleScroll() {
    if (!carouselContainer) return;

    const scrollLeft = carouselContainer.scrollLeft;
    const itemWidth = carouselContainer.scrollWidth / specialties.length;
    const newIndex = Math.round(scrollLeft / itemWidth);

    if (newIndex !== currentIndex) {
      currentIndex = newIndex;
    }
  }

  // Navigate to specific index
  function goToIndex(index) {
    if (!carouselContainer) return;

    const itemWidth = carouselContainer.scrollWidth / specialties.length;
    carouselContainer.scrollTo({
      left: itemWidth * index,
      behavior: 'smooth'
    });
  }
</script>

{#if specialties && specialties.length > 0}
  <div class="carousel-wrapper">
    <div
      class="carousel-container"
      bind:this={carouselContainer}
      on:scroll={handleScroll}
    >
      {#each specialties as specialty, index}
        <div class="carousel-item">
          <SpecCard
            itemDescrip={specialty.description || ''}
            itemName={specialty.name || ''}
            cardType={specialty.type || 'Item'}
          />
        </div>
      {/each}
    </div>

    <!-- Pagination Dots -->
    {#if specialties.length > 1}
      <div class="pagination-dots">
        {#each specialties as _, index}
          <button
            class="dot"
            class:active={currentIndex === index}
            on:click={() => goToIndex(index)}
            aria-label={`Go to specialty ${index + 1}`}
          />
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <p class="text-sm text-gray-500 italic">No specialty information available.</p>
{/if}

<style>
  .carousel-wrapper {
    width: 100%;
    position: relative;
  }

  .carousel-container {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch; /* Smooth momentum scrolling on iOS */
    gap: 12px;
    padding: 8px 4px;
    /* Hide scrollbar but keep functionality */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .carousel-container::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .carousel-item {
    /* Cards at 2/3 width across all breakpoints */
    flex: 0 0 66.67%;
    scroll-snap-align: center;
    scroll-snap-stop: always;
  }

  /* Slightly narrower on mobile for better fit */
  @media (max-width: 767px) {
    .carousel-item {
      flex: 0 0 85%;
    }
  }

  /* Pagination Dots */
  .pagination-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #d1d5db;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
    /* Touch-friendly tap target */
    position: relative;
  }

  :global(.dark) .dot {
    background-color: #4b5563;
  }

  .dot::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
  }

  .dot.active {
    background-color: #4CAF50;
    width: 24px;
    border-radius: 4px;
  }

  .dot:hover {
    background-color: #9ca3af;
  }

  :global(.dark) .dot:hover {
    background-color: #6b7280;
  }

  .dot.active:hover {
    background-color: #45a049;
  }
</style>

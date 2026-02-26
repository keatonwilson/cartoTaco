<script>
  import { Card } from 'flowbite-svelte';
  import { isMobile } from '$lib/deviceDetection';

  export let cardType;
  export let itemName;
  export let shortDescrip = '';
  export let longDescrip = '';
  export let imgUrl = null;

  // Expandable state — only meaningful when there is a long description
  let isExpanded = false;

  function toggleExpand() {
    if (longDescrip) {
      isExpanded = !isExpanded;
    }
  }

  $: hasLongDescrip = !!longDescrip;

  // Determine image based on card type if not explicitly provided
  $: cardImage = imgUrl || getImageByType(cardType);

  // Function to determine which icon to use based on card type
  function getImageByType(type) {
    switch(type.toLowerCase()) {
      case 'item':
        return '/corn.svg';
      case 'protein':
        return '/cow.svg'; // Cow icon for protein
      case 'salsa':
        return '/pepper.svg'; // Pepper icon for salsa
      default:
        return '/corn.svg';
    }
  }

  // Function to determine card color based on type
  $: cardClass = getCardClass(cardType);

  function getCardClass(type) {
    switch(type.toLowerCase()) {
      case 'item':
        return 'specialty-item';
      case 'protein':
        return 'specialty-protein';
      case 'salsa':
        return 'specialty-salsa';
      default:
        return '';
    }
  }
</script>
  
<div
  class="specialty-card {cardClass}"
  class:mobile={$isMobile}
  class:expanded={isExpanded}
  on:click={toggleExpand}
  on:keydown={(e) => e.key === 'Enter' && toggleExpand()}
  role="button"
  tabindex="0"
  aria-expanded={isExpanded}
>
  <div class="compact-card">
    <div class="icon-container">
      <span class="type-label">{cardType}</span>
      <img src={cardImage} alt={cardType} class="specialty-icon" />
    </div>
    <div class="content">
      <h5 class="card-title">{itemName}</h5>
      <p class="card-description">{shortDescrip}</p>
      {#if isExpanded && longDescrip}
        <p class="card-long-description">{longDescrip}</p>
      {/if}
      {#if hasLongDescrip}
        {#if isExpanded}
          <div class="expand-hint">Click to collapse</div>
        {:else}
          <div class="expand-hint">Click to read more</div>
        {/if}
      {/if}
    </div>
  </div>
</div>
  
<style>
  .specialty-card {
    margin-bottom: 0.5rem;
    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    position: relative;
    width: 100%;
    cursor: pointer;
    border-radius: 10px; /* Match the inner card's border-radius */
  }

  .specialty-card:hover {
    transform: translateY(-3px);
    z-index: 10;
  }

  .specialty-card:focus {
    outline: none; /* Remove default outline */
  }

  /* Subtle rounded outline on expanded/focused cards */
  .specialty-card.expanded,
  .specialty-card:focus {
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.25);
  }

  .specialty-card.expanded:hover,
  .specialty-card:focus:hover {
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.35), 0 6px 16px rgba(0,0,0,0.18);
  }

  .compact-card {
    display: flex;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    height: auto;
    min-height: 120px;
    width: 100%;
    position: relative;
    border-left: 4px solid transparent;
    transition: all 0.3s ease;
  }

  :global(.dark) .compact-card {
    background: #1f2937;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }

  .specialty-card:hover .compact-card {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  /* Expanded state */
  .specialty-card.expanded .compact-card {
    min-height: auto;
  }

  /* Mobile */
  .specialty-card.mobile .compact-card {
    min-height: 130px;
  }

  @media (min-width: 768px) {
    .compact-card {
      min-height: 140px;
    }
  }

  @media (min-width: 1024px) {
    .compact-card {
      min-height: 150px;
    }
  }
  
  .icon-container {
    flex: 0 0 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
  }

  .type-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 10px;
    border-radius: 12px;
    color: white;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  .specialty-icon {
    width: 36px;
    height: 36px;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
  }

  @media (min-width: 1024px) {
    .specialty-icon {
      width: 40px;
      height: 40px;
    }
  }
  
  .content {
    flex: 1 1 auto;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    min-width: 0;
  }

  .card-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 4px 0;
    color: #1a1a1a;
    line-height: 1.3;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  :global(.dark) .card-title {
    color: #f9fafb;
  }

  @media (min-width: 768px) {
    .card-title {
      font-size: 15px;
    }
  }

  @media (min-width: 1024px) {
    .card-title {
      font-size: 15px;
    }
  }

  .card-description {
    font-size: 11px;
    color: #555;
    line-height: 1.4;
    margin: 4px 0 0 0;
  }

  :global(.dark) .card-description {
    color: #d1d5db;
  }

  .card-long-description {
    font-size: 11px;
    color: #555;
    line-height: 1.4;
    margin: 6px 0 0 0;
    padding-top: 6px;
    border-top: 1px solid #e5e7eb;
  }

  :global(.dark) .card-long-description {
    color: #d1d5db;
    border-top-color: #374151;
  }

  @media (min-width: 768px) {
    .card-description,
    .card-long-description {
      font-size: 12px;
    }
  }

  .expand-hint {
    font-size: 10px;
    color: #888;
    font-style: italic;
    margin-top: 4px;
    opacity: 0.7;
  }

  :global(.dark) .expand-hint {
    color: #9ca3af;
  }

  .specialty-card:hover .expand-hint {
    opacity: 1;
  }
  
  
  /* Color theming - Item (Green) */
  .specialty-item .compact-card {
    border-left-color: #4CAF50;
    background: linear-gradient(to right, rgba(76, 175, 80, 0.03), white);
  }

  :global(.dark) .specialty-item .compact-card {
    background: linear-gradient(to right, rgba(76, 175, 80, 0.1), #1f2937);
  }

  .specialty-item .icon-container {
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.08));
  }

  :global(.dark) .specialty-item .icon-container {
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(76, 175, 80, 0.15));
  }

  .specialty-item .type-label {
    background: linear-gradient(135deg, #4CAF50, #45a049);
  }

  /* Color theming - Protein (Orange) */
  .specialty-protein .compact-card {
    border-left-color: #FF9800;
    background: linear-gradient(to right, rgba(255, 152, 0, 0.03), white);
  }

  :global(.dark) .specialty-protein .compact-card {
    background: linear-gradient(to right, rgba(255, 152, 0, 0.1), #1f2937);
  }

  .specialty-protein .icon-container {
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(255, 152, 0, 0.08));
  }

  :global(.dark) .specialty-protein .icon-container {
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.25), rgba(255, 152, 0, 0.15));
  }

  .specialty-protein .type-label {
    background: linear-gradient(135deg, #FF9800, #F57C00);
  }

  /* Color theming - Salsa (Red) */
  .specialty-salsa .compact-card {
    border-left-color: #F44336;
    background: linear-gradient(to right, rgba(244, 67, 54, 0.03), white);
  }

  :global(.dark) .specialty-salsa .compact-card {
    background: linear-gradient(to right, rgba(244, 67, 54, 0.1), #1f2937);
  }

  .specialty-salsa .icon-container {
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.15), rgba(244, 67, 54, 0.08));
  }

  :global(.dark) .specialty-salsa .icon-container {
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.25), rgba(244, 67, 54, 0.15));
  }

  .specialty-salsa .type-label {
    background: linear-gradient(135deg, #F44336, #E53935);
  }
</style>
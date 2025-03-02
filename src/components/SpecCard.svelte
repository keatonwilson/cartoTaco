<script>
  import { Card } from 'flowbite-svelte';

  export let cardType;
  export let itemName;
  export let itemDescrip;
  export let imgUrl = null;

  // Determine image based on card type if not explicitly provided
  $: cardImage = imgUrl || getImageByType(cardType);
  
  // Function to determine which icon to use based on card type
  function getImageByType(type) {
    switch(type.toLowerCase()) {
      case 'item':
        return '/burrito_simple.svg'; // burrito icon for speciality
      case 'protein':
        return '/cow.svg'; // Cow icon for protein
      case 'salsa':
        return '/salsa.svg'; // Pepper icon for salsa
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

  // Truncate description to keep cards compact
  $: shortDescription = itemDescrip.length > 50 
    ? itemDescrip.substring(0, 48) + '...' 
    : itemDescrip;
</script>
  
<div class="specialty-card {cardClass}" title={itemDescrip}>
  <div class="compact-card">
    <div class="icon-container">
      <img src={cardImage} alt={cardType} class="specialty-icon" />
    </div>
    <div class="content">
      <p class="card-type">{cardType}</p>
      <h5 class="card-title">{itemName}</h5>
    </div>
  </div>
  
  <!-- Tooltip that shows on hover -->
  <div class="hover-description">
    <p>{itemDescrip}</p>
  </div>
</div>
  
<style>
  .specialty-card {
    margin-bottom: 0.5rem;
    transition: transform 0.2s ease-in-out;
    position: relative;
    width: 100%;
  }
  
  .specialty-card:hover {
    transform: translateY(-2px);
    z-index: 10;
  }
  
  .compact-card {
    display: flex;
    background-color: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    height: 90px; /* Increased height */
    width: 100%;
    position: relative;
  }
  
  .icon-container {
    flex: 0 0 45px; /* Significantly reduced width to prioritize text */
    height: 90px; /* Keep consistent height */
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
  }
  
  .specialty-icon {
    width: 28px; /* Smaller icon size */
    height: 28px; /* Smaller icon size */
    object-fit: contain;
  }
  
  .content {
    flex: 1 1 auto; /* Allow content to expand and fill the available space */
    padding: 12px 14px 12px 8px; /* Adjusted padding to give more room to text */
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    min-width: 0; /* Important for text overflow to work */
  }
  
  .card-type {
    font-size: 11px; /* Slightly increased font size */
    font-style: italic;
    color: #6b7280;
    margin: 0;
    line-height: 1.1;
  }
  
  .card-title {
    font-size: 15px; /* Slightly adjusted font size */
    font-weight: 600;
    margin: 4px 0 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2; /* Show up to 2 lines */
    -webkit-box-orient: vertical;
    white-space: normal; /* Allow wrapping */
    max-height: 3em; /* Limit height */
  }
  
  /* Hover description */
  .hover-description {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    margin-top: 5px;
    background-color: white;
    padding: 8px;
    border-radius: 6px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    z-index: 100;
    font-size: 12px;
    line-height: 1.4;
    max-width: 250px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s, transform 0.2s;
    transform: translateY(-5px);
    overflow: visible;
  }
  
  .specialty-card:hover .hover-description {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  
  .hover-description p {
    margin: 0;
    white-space: normal; /* Allow text to wrap */
  }
  
  /* Color theming */
  .specialty-item .icon-container {
    background-color: rgba(76, 175, 80, 0.1);
    border-right: 2px solid #4CAF50;
  }
  
  .specialty-protein .icon-container {
    background-color: rgba(255, 152, 0, 0.1);
    border-right: 2px solid #FF9800;
  }
  
  .specialty-salsa .icon-container {
    background-color: rgba(244, 67, 54, 0.1);
    border-right: 2px solid #F44336;
  }
  
  .specialty-item .hover-description {
    border-top: 3px solid #4CAF50;
  }
  
  .specialty-protein .hover-description {
    border-top: 3px solid #FF9800;
  }
  
  .specialty-salsa .hover-description {
    border-top: 3px solid #F44336;
  }
</style>
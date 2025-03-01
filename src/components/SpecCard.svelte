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

  // Truncate description to keep cards compact
  $: shortDescription = itemDescrip.length > 50 
    ? itemDescrip.substring(0, 48) + '...' 
    : itemDescrip;
</script>
  
<div class="specialty-card {cardClass}">
  <div class="compact-card">
    <div class="icon-container">
      <img src={cardImage} alt={cardType} class="specialty-icon" />
    </div>
    <div class="content">
      <p class="card-type">{cardType}</p>
      <h5 class="card-title">{itemName}</h5>
    </div>
    <div class="description-tooltip">
      <div class="tooltip-content">
        <p>{itemDescrip}</p>
      </div>
    </div>
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
    height: 70px;
    width: 100%;
    position: relative;
  }
  
  .icon-container {
    flex: 0 0 70px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }
  
  .specialty-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  
  .content {
    flex: 1;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    min-width: 0; /* Important for text overflow to work */
  }
  
  .card-type {
    font-size: 10px;
    font-style: italic;
    color: #6b7280;
    margin: 0;
    line-height: 1;
  }
  
  .card-title {
    font-size: 14px;
    font-weight: 600;
    margin: 4px 0 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
  
  /* Tooltip for description */
  .description-tooltip {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }
  
  .specialty-card:hover .description-tooltip {
    opacity: 1;
    pointer-events: auto;
  }
  
  .tooltip-content {
    position: absolute;
    top: 75px;
    left: 0;
    width: 200px;
    background-color: white;
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 20;
    color: #333;
    max-width: 220px;
  }
  
  .tooltip-content p {
    margin: 0;
    line-height: 1.4;
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
  
  .specialty-item .tooltip-content {
    border-top: 3px solid #4CAF50;
  }
  
  .specialty-protein .tooltip-content {
    border-top: 3px solid #FF9800;
  }
  
  .specialty-salsa .tooltip-content {
    border-top: 3px solid #F44336;
  }
</style>
<script>
  import { Card, Button } from 'flowbite-svelte';

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
        return '/wheat.svg'; // Use wheat icon for protein
      case 'salsa':
        return '/pepper.svg'; // We'll create this icon
      default:
        return '/corn.svg';
    }
  }
  
  // Function to determine card border color based on type
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
  
<div class="specialty-card {cardClass}">
  <Card img={cardImage} horizontal size="md">
    <p class="mb-1 italic text-gray-700 dark:text-gray-400 text-xs leading-tight">{cardType}</p>
    <h5 class="mb-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{itemName}</h5>
    <p class="mb-1 font-normal text-gray-700 dark:text-gray-400 text-xs leading-tight">{itemDescrip}</p>
  </Card>
</div>
  
<style>
  .specialty-card {
    margin-bottom: 0.75rem;
    transition: transform 0.2s ease-in-out;
  }
  
  .specialty-card:hover {
    transform: translateY(-2px);
  }
  
  :global(.specialty-item) :global(.card) {
    border-left: 3px solid #4CAF50; /* Green for items */
  }
  
  :global(.specialty-protein) :global(.card) {
    border-left: 3px solid #FF9800; /* Orange for proteins */
  }
  
  :global(.specialty-salsa) :global(.card) {
    border-left: 3px solid #F44336; /* Red for salsas */
  }
</style>
<script>
    import { Card, Button } from 'flowbite-svelte';

    export let cardType;
    export let itemName;
    export let itemDescrip;

  </script>
  
  <div class="space-y-1">
    <Card img="/corn.svg" href="/" horizontal size="md">
      <p class="mb-1 italic text-gray-700 dark:text-gray-400 text-xs leading-tight">{cardType}</p>
      <h5 class="mb-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{itemName}</h5>
      <p class="mb-1 font-normal text-gray-700 dark:text-gray-400 text-xs leading-tight">{itemDescrip}</p>
    </Card>
  </div>
  
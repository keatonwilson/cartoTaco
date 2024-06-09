<!-- src/routes/index.svelte -->
<script>
    import Map from './Map.svelte';
    import Card from '../components/Card.svelte';
    import { locations } from '../lib/stores';
  </script>
  
  <main>
    <Map />
  
    {#each $locations as location}
      <Card name={location.name} description={location.description} />
    {/each}
  </main>
  
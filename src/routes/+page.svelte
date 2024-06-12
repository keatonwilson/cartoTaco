<!-- src/routes/index.svelte -->
<script>
    import Map from './Map.svelte';
    import Card from '../components/Card.svelte';
    import { sites } from '../lib/stores';
  </script>
  
  <main>
    <Map />
  
    {#each $sites as location}
      <Card name={sites.name} description={sites.description} />
    {/each}
  </main>
  
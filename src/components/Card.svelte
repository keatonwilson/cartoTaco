<!-- src/components/Card.svelte -->
<script>
  export let name;
  export let description;
</script>

<style>
  .card {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    margin: 8px;
  }
</style>

<div class="card">
  <h3>{name}</h3>
  <p>{description}</p>
</div>

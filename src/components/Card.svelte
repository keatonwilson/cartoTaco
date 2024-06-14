<!-- src/components/Card.svelte -->
<script>
  export let name;
  export let type;
</script>

<style>
  .popup-card {
    width: 200px;
    padding: 10px;
    background: white;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  .popup-card h3 {
    margin: 0;
    font-size: 18px;
  }
  .popup-card p {
    margin: 5px 0 0;
  }
</style>

<div class="popup-card">
  <h3>{name}</h3>
  <p>{type}</p>
</div>

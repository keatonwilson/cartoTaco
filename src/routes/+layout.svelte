

<script>
  import "../app.css";
  import Header from "$lib/../components/Header.svelte";
</script>

<div class="app">
  <Header />
  <main>
    <slot></slot>
  </main>
</div>

<style>
  .app {
    position: relative;
    min-height: 100vh;
  }

  main {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
  }
</style>
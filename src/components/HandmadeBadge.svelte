<script>
  import { HandPalm } from 'phosphor-svelte';
</script>

<div class="handmade-badge">
  <HandPalm size={14} color="white" weight="fill" />
  <span>Handmade Tortillas</span>
</div>

<style>
  .handmade-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 5px 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: white;
    user-select: none;
  }

</style>

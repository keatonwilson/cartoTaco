<script>
  // Shared loading state with a little personality (U4 of the UI refresh).
  export let message = 'Warming up the tortillas…';
</script>

<div class="loading-state" role="status" aria-live="polite">
  <span class="taco" aria-hidden="true">🌮</span>
  <div class="dots" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
  <p class="loading-message">{message}</p>
</div>

<style>
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 2rem 1rem;
  }

  .taco {
    font-size: 34px;
    animation: taco-bob 1.2s ease-in-out infinite;
  }

  .dots {
    display: flex;
    gap: 5px;
  }

  .dots span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    animation: dot-pulse 1.2s ease-in-out infinite;
  }

  .dots span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .dots span:nth-child(3) {
    animation-delay: 0.3s;
  }

  .loading-message {
    font-size: 13px;
    color: var(--ink-2);
    margin: 0;
  }

  @keyframes taco-bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }

  @keyframes dot-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .taco,
    .dots span {
      animation: none;
    }
  }
</style>

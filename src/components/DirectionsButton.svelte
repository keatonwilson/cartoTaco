<script>
  import { isMobile } from '$lib/deviceDetection';

  export let latitude;
  export let longitude;
  export let name;

  // Detect platform
  function getPlatform() {
    if (typeof navigator === 'undefined') return 'desktop';

    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // iOS detection
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return 'ios';
    }

    // Android detection
    if (/android/i.test(userAgent)) {
      return 'android';
    }

    return 'desktop';
  }

  function openDirections() {
    const platform = getPlatform();
    const encodedName = encodeURIComponent(name);

    let url;

    switch (platform) {
      case 'ios':
        // Apple Maps deeplink
        url = `maps://?q=${encodedName}&ll=${latitude},${longitude}`;
        break;

      case 'android':
        // Google Maps intent (geo: URI)
        url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedName})`;
        break;

      case 'desktop':
      default:
        // Google Maps web
        url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        break;
    }

    // Open in new tab/window or trigger native app
    window.open(url, '_blank');
  }
</script>

<button
  class="directions-button"
  on:click={openDirections}
  class:mobile={$isMobile}
  title="Get Directions"
  aria-label="Get Directions"
>
  <svg class="map-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
</button>

<style>
  .directions-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    /* Match social button size */
    padding: 8px;
    width: 36px;
    height: 36px;
  }

  .directions-button:hover {
    background-color: #45a049;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.25);
  }

  .directions-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .map-icon {
    width: 18px;
    height: 18px;
  }
</style>

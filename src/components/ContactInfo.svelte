<script>
  import { GlobeOutline, PhoneOutline, MapPinAltSolid } from 'flowbite-svelte-icons';
  import DirectionsButton from './DirectionsButton.svelte';

  export let phone = null;
  export let website = null;
  export let instagram = null;
  export let facebook = null;
  export let address = null;
  export let latitude = null;
  export let longitude = null;
  export let name = null;

  // Format phone number for tel: link
  function formatPhoneForLink(phoneStr) {
    if (!phoneStr) return '';
    return phoneStr.replace(/\D/g, '');
  }

  // Check if any contact info exists
  $: hasContactInfo = phone || website || instagram || facebook || address;
</script>

{#if hasContactInfo}
  <div class="contact-container">
    <h2 class="text-m font-semibold text-gray-800 mb-2">Contact & Links</h2>

    <div class="contact-items">
      <!-- Address -->
      {#if address}
        <div class="contact-item">
          <MapPinAltSolid size="xs" class="icon" />
          <span class="contact-text">{address}</span>
        </div>
      {/if}

      <!-- Phone -->
      {#if phone}
        <div class="contact-item">
          <PhoneOutline size="xs" class="icon" />
          <a href="tel:{formatPhoneForLink(phone)}" class="contact-link">
            {phone}
          </a>
        </div>
      {/if}

      <!-- Website -->
      {#if website}
        <div class="contact-item">
          <GlobeOutline size="xs" class="icon" />
          <a href={website} target="_blank" rel="noopener noreferrer" class="contact-link">
            Website
          </a>
        </div>
      {/if}

      <!-- Action Buttons: Directions + Social Media -->
      {#if latitude || longitude || instagram || facebook}
        <div class="action-buttons">
          {#if latitude && longitude && name}
            <DirectionsButton {latitude} {longitude} {name} />
          {/if}

          {#if instagram}
            <a
              href="https://instagram.com/{instagram}"
              target="_blank"
              rel="noopener noreferrer"
              class="social-button instagram"
              aria-label="Instagram"
              title="Instagram"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          {/if}

          {#if facebook}
            <a
              href="https://facebook.com/{facebook}"
              target="_blank"
              rel="noopener noreferrer"
              class="social-button facebook"
              aria-label="Facebook"
              title="Facebook"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .contact-container {
    margin-top: 12px;
    padding: 12px;
    background-color: #f9f9f9;
    border-radius: 8px;
  }

  .contact-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #555;
  }

  .contact-item :global(.icon) {
    color: #FE795D;
    flex-shrink: 0;
  }

  .contact-text {
    line-height: 1.4;
  }

  .contact-link {
    color: #FE795D;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .contact-link:hover {
    color: #d66548;
    text-decoration: underline;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .social-button {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Icon-only compact buttons */
    padding: 8px;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s;
    color: white;
  }

  .social-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .instagram {
    background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
  }

  .facebook {
    background-color: #1877f2;
  }

  .social-button svg {
    flex-shrink: 0;
  }
</style>

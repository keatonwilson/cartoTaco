<script>
  import { onMount } from 'svelte';
  import { signOut } from '$lib/authStore';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { UserCircleOutline, EnvelopeOutline, CalendarMonthOutline, HeartSolid } from 'flowbite-svelte-icons';
  import { favoritesCount, loadFavorites } from '$lib/favoritesStore';
  import TasteProfile from '../../../components/TasteProfile.svelte';

  export let data;

  const user = data.user;
  const signupDate = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Load favorites count
  onMount(() => {
    loadFavorites();
  });

  async function handleSignOut() {
    await signOut();
    goto('/');
  }
</script>

<svelte:head>
  <title>Profile - CartoTaco</title>
</svelte:head>

<div class="profile-container">
  <div class="profile-content">
    <!-- Header -->
    <div class="profile-header">
      {#if browser}
        <UserCircleOutline class="profile-icon" size="xl" />
      {/if}
      <h1 class="profile-title">Your Profile</h1>
    </div>

    <!-- User Info Card -->
    <div class="info-card">
      <div class="info-section">
        <h2 class="section-title">Account Details</h2>

        <div class="info-item">
          <div class="info-label">
            {#if browser}
              <EnvelopeOutline class="info-icon" />
            {/if}
            <span>Email</span>
          </div>
          <div class="info-value">{user.email}</div>
        </div>

        <div class="info-item">
          <div class="info-label">
            {#if browser}
              <CalendarMonthOutline class="info-icon" />
            {/if}
            <span>Member Since</span>
          </div>
          <div class="info-value">{signupDate}</div>
        </div>

        <button class="info-item clickable" on:click={() => goto('/favorites')}>
          <div class="info-label">
            {#if browser}
              <HeartSolid class="info-icon" />
            {/if}
            <span>Favorite Locations</span>
          </div>
          <div class="info-value">{$favoritesCount}</div>
        </button>
      </div>

      <div class="divider"></div>

      <!-- Taste Profile -->
      <div class="info-section">
        <h2 class="section-title">Your Taste Profile</h2>
        <TasteProfile />
      </div>

      <div class="divider"></div>

      <!-- Actions -->
      <div class="actions-section">
        <button
          class="sign-out-button"
          on:click={handleSignOut}
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .profile-container {
    min-height: calc(100vh - 60px);
    padding: 2rem 1rem;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
    transition: background 0.3s ease;
  }

  :global(.dark) .profile-container {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  }

  .profile-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
  }

  .profile-icon {
    color: #FE795D;
    margin-bottom: 1rem;
  }

  .profile-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
  }

  :global(.dark) .profile-title {
    color: #f9fafb;
  }

  .info-card {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }

  :global(.dark) .info-card {
    background: #1f2937;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .info-section {
    margin-bottom: 1.5rem;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 1rem;
  }

  :global(.dark) .section-title {
    color: #f9fafb;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #F9FAFB;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.dark) .info-item {
    background: #111827;
  }

  .info-item:last-child {
    margin-bottom: 0;
  }

  .info-item.clickable {
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .info-item.clickable:hover {
    background: white;
    border-color: #FE795D;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(254, 121, 93, 0.2);
  }

  :global(.dark) .info-item.clickable:hover {
    background: #1f2937;
  }

  .info-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  :global(.dark) .info-label {
    color: #d1d5db;
  }

  .info-icon {
    color: #FE795D;
  }

  .info-value {
    font-size: 0.875rem;
    color: #6B7280;
  }

  :global(.dark) .info-value {
    color: #9ca3af;
  }

  .divider {
    height: 1px;
    background: #E5E7EB;
    margin: 2rem 0;
  }

  .actions-section {
    display: flex;
    justify-content: center;
  }

  .sign-out-button {
    padding: 0.75rem 2rem;
    background: transparent;
    color: #DC2626;
    border: 1px solid #DC2626;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sign-out-button:hover {
    background: #DC2626;
    color: white;
  }

  @media (min-width: 640px) {
    .info-item {
      padding: 1.25rem;
    }
  }
</style>

<script>
  import { browser } from '$app/environment';
  import { UserCircleOutline, CalendarMonthOutline } from 'flowbite-svelte-icons';

  export let data;
  $: profile = data.profile;

  $: signupDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      })
    : '';
</script>

<svelte:head>
  <title>{profile.display_name || profile.username} · CartoTaco</title>
  <meta name="description" content={profile.bio || `${profile.display_name || profile.username}'s taco profile on CartoTaco`} />
</svelte:head>

<div class="profile-page">
  <div class="profile-card">
    <div class="profile-header">
      <div class="avatar-wrapper">
        {#if profile.avatar_url}
          <img src={profile.avatar_url} alt="{profile.display_name || profile.username}'s avatar" class="avatar-image" />
        {:else if browser}
          <UserCircleOutline class="profile-icon" size="xl" />
        {/if}
      </div>
      <h1 class="display-name">{profile.display_name || profile.username}</h1>
      <div class="username">@{profile.username}</div>
      {#if profile.bio}
        <p class="bio">{profile.bio}</p>
      {/if}
      {#if signupDate}
        <div class="meta">
          {#if browser}<CalendarMonthOutline class="meta-icon" />{/if}
          <span>Member since {signupDate}</span>
        </div>
      {/if}
    </div>

    <div class="placeholder-section">
      <h2 class="section-title">Recent Check-ins</h2>
      <p class="placeholder-text">Check-ins coming soon — when this user starts logging taco visits, they'll show up here.</p>
    </div>
  </div>
</div>

<style>
  .profile-page {
    min-height: calc(100vh - 60px);
    padding: 2rem 1rem;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
  }

  :global(.dark) .profile-page {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  }

  .profile-card {
    width: 100%;
    box-sizing: border-box;
    max-width: 720px;
    margin: 0 auto;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 2.5rem 2rem;
  }

  :global(.dark) .profile-card {
    background: #1f2937;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
  }

  .avatar-wrapper {
    margin-bottom: 1rem;
  }

  .avatar-image {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #FE795D;
    background: white;
  }

  :global(.profile-icon) {
    color: #FE795D;
  }

  .display-name {
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global(.dark) .display-name {
    color: #f9fafb;
  }

  .username {
    color: #FE795D;
    font-size: 0.9375rem;
    font-weight: 500;
    margin-top: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }

  .bio {
    color: #374151;
    font-size: 0.9375rem;
    line-height: 1.5;
    max-width: 480px;
    margin-top: 1rem;
    margin-bottom: 0;
  }

  :global(.dark) .bio {
    color: #d1d5db;
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: #6b7280;
    font-size: 0.8125rem;
    margin-top: 1rem;
  }

  :global(.dark) .meta {
    color: #9ca3af;
  }

  :global(.meta-icon) {
    color: #FE795D;
  }

  .placeholder-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 1.5rem;
    margin-top: 1.5rem;
  }

  :global(.dark) .placeholder-section {
    border-top-color: #374151;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  :global(.dark) .section-title {
    color: #f9fafb;
  }

  .placeholder-text {
    color: #6b7280;
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0;
  }

  :global(.dark) .placeholder-text {
    color: #9ca3af;
  }
</style>

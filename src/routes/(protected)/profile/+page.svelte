<script>
  import { onMount } from 'svelte';
  import { signOut } from '$lib/authStore';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { UserCircleOutline, EnvelopeOutline, CalendarMonthOutline, HeartSolid } from 'flowbite-svelte-icons';
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
  import LinkSimple from 'phosphor-svelte/lib/LinkSimple';
  import { favoritesCount, loadFavorites } from '$lib/favoritesStore';
  import { getOwnProfile, updateProfile, uploadAvatar, validateUsername, BIO_MAX, DISPLAY_NAME_MAX } from '$lib/profiles';
  import { toast } from '$lib/toastStore';
  import TasteProfile from '../../../components/TasteProfile.svelte';

  export let data;

  const user = data.user;
  const signupDate = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let profile = null;
  let displayName = '';
  let username = '';
  let bio = '';
  let avatarUrl = '';
  let usernameError = '';
  let savingProfile = false;
  let uploadingAvatar = false;
  let fileInput;

  $: bioRemaining = BIO_MAX - (bio?.length || 0);

  onMount(async () => {
    loadFavorites();
    const result = await getOwnProfile();
    if (result.success && result.data) {
      profile = result.data;
      displayName = result.data.display_name || '';
      username = result.data.username || '';
      bio = result.data.bio || '';
      avatarUrl = result.data.avatar_url || '';
    } else if (result.error) {
      toast.error(`Couldn't load your profile: ${result.error}`);
    }
  });

  function handleUsernameInput(e) {
    username = e.target.value.toLowerCase();
    usernameError = username ? (validateUsername(username) || '') : '';
  }

  async function saveProfile() {
    const usernameMsg = validateUsername(username);
    if (usernameMsg) {
      usernameError = usernameMsg;
      return;
    }
    if (bio.length > BIO_MAX) {
      toast.error(`Bio must be ${BIO_MAX} characters or fewer`);
      return;
    }

    savingProfile = true;
    const result = await updateProfile({
      display_name: displayName,
      username,
      bio
    });
    savingProfile = false;

    if (result.success) {
      profile = result.data;
      toast.success('Profile saved');
    } else {
      toast.error(result.error || 'Could not save profile');
      if (result.error?.toLowerCase().includes('username')) {
        usernameError = result.error;
      }
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadingAvatar = true;
    const result = await uploadAvatar(file);
    uploadingAvatar = false;
    if (result.success) {
      avatarUrl = result.url;
      toast.success('Avatar updated');
    } else {
      toast.error(result.error || 'Could not upload avatar');
    }
    if (fileInput) fileInput.value = '';
  }

  async function copyPublicLink() {
    if (!username || !browser) return;
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied');
    } catch {
      toast.info(url);
    }
  }

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
    <div class="profile-header">
      <div class="avatar-wrapper">
        {#if avatarUrl}
          <img src={avatarUrl} alt="Avatar" class="avatar-image" />
        {:else if browser}
          <UserCircleOutline class="profile-icon" size="xl" />
        {/if}
        <button
          class="avatar-edit-button"
          on:click={() => fileInput?.click()}
          disabled={uploadingAvatar}
          title="Change avatar"
          aria-label="Change avatar"
        >
          {#if browser}
            <UploadSimple size={14} weight="bold" />
          {/if}
        </button>
        <input
          bind:this={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          on:change={handleAvatarChange}
          class="hidden-file-input"
        />
      </div>
      <h1 class="profile-title">Your Profile</h1>
      {#if username}
        <button class="public-link" on:click={copyPublicLink} title="Copy public profile link">
          {#if browser}<LinkSimple size={14} />{/if}
          <span>cartotaco.app/u/{username}</span>
        </button>
      {/if}
    </div>

    <div class="info-card">
      <div class="info-section">
        <h2 class="section-title">Public Identity</h2>
        <p class="section-help">This is what shows on your public profile and on check-ins. Email stays private.</p>

        <label class="field">
          <span class="field-label">Display name</span>
          <input
            type="text"
            class="field-input"
            bind:value={displayName}
            maxlength={DISPLAY_NAME_MAX}
            placeholder="What should we call you?"
          />
        </label>

        <label class="field">
          <span class="field-label">
            Username
            <span class="field-hint">3–20 characters · lowercase, numbers, underscores</span>
          </span>
          <div class="username-input-wrapper">
            <span class="username-prefix">/u/</span>
            <input
              type="text"
              class="field-input"
              class:invalid={usernameError}
              value={username}
              on:input={handleUsernameInput}
              maxlength={20}
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          {#if usernameError}
            <span class="field-error">{usernameError}</span>
          {/if}
        </label>

        <label class="field">
          <span class="field-label">
            Bio
            <span class="field-hint">{bioRemaining} characters left</span>
          </span>
          <textarea
            class="field-input"
            class:invalid={bio.length > BIO_MAX}
            bind:value={bio}
            maxlength={BIO_MAX}
            rows="3"
            placeholder="Favorite protein? Spice tolerance? Tell folks who's behind the votes."
          ></textarea>
        </label>

        <div class="form-actions">
          <button
            class="primary-button"
            on:click={saveProfile}
            disabled={savingProfile || !!usernameError}
          >
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div class="divider"></div>

      <div class="info-section">
        <h2 class="section-title">Account Details</h2>

        <div class="info-item">
          <div class="info-label">
            {#if browser}<EnvelopeOutline class="info-icon" />{/if}
            <span>Email</span>
          </div>
          <div class="info-value">{user.email}</div>
        </div>

        <div class="info-item">
          <div class="info-label">
            {#if browser}<CalendarMonthOutline class="info-icon" />{/if}
            <span>Member Since</span>
          </div>
          <div class="info-value">{signupDate}</div>
        </div>

        <button class="info-item clickable" on:click={() => goto('/favorites')}>
          <div class="info-label">
            {#if browser}<HeartSolid class="info-icon" />{/if}
            <span>Favorite Locations</span>
          </div>
          <div class="info-value">{$favoritesCount}</div>
        </button>
      </div>

      <div class="divider"></div>

      <div class="info-section">
        <h2 class="section-title">Taste Profile</h2>
        <TasteProfile />
      </div>

      <div class="divider"></div>

      <div class="actions-section">
        <button class="sign-out-button" on:click={handleSignOut}>
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
    width: 100%;
    box-sizing: border-box;
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

  .avatar-wrapper {
    position: relative;
    margin-bottom: 1rem;
  }

  .avatar-image {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #FE795D;
    background: white;
  }

  :global(.profile-icon) {
    color: #FE795D;
  }

  .avatar-edit-button {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #FE795D;
    color: white;
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease;
  }

  :global(.dark) .avatar-edit-button {
    border-color: #1f2937;
  }

  .avatar-edit-button:hover:not(:disabled) {
    transform: scale(1.05);
    background: #EF562F;
  }

  .avatar-edit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hidden-file-input {
    display: none;
  }

  .profile-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  :global(.dark) .profile-title {
    color: #f9fafb;
  }

  .public-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(254, 121, 93, 0.1);
    border: 1px solid rgba(254, 121, 93, 0.3);
    color: #FE795D;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: inherit;
  }

  .public-link:hover {
    background: rgba(254, 121, 93, 0.18);
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
    margin-bottom: 0.25rem;
  }

  :global(.dark) .section-title {
    color: #f9fafb;
  }

  .section-help {
    font-size: 0.8125rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }

  :global(.dark) .section-help {
    color: #9ca3af;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 1rem;
  }

  .field-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }

  :global(.dark) .field-label {
    color: #d1d5db;
  }

  .field-hint {
    font-weight: 400;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .field-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
    color: #111827;
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  :global(.dark) .field-input {
    background: #111827;
    border-color: #374151;
    color: #f3f4f6;
  }

  .field-input:focus {
    outline: none;
    border-color: #FE795D;
    box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.15);
  }

  .field-input.invalid {
    border-color: #ef4444;
  }

  .username-input-wrapper {
    display: flex;
    align-items: stretch;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    overflow: hidden;
    background: white;
    transition: border-color 0.15s ease;
  }

  .username-input-wrapper:focus-within {
    border-color: #FE795D;
    box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.15);
  }

  :global(.dark) .username-input-wrapper {
    background: #111827;
    border-color: #374151;
  }

  .username-prefix {
    padding: 0.5rem 0.75rem;
    background: #f9fafb;
    color: #6b7280;
    font-size: 0.875rem;
    font-family: ui-monospace, SFMono-Regular, monospace;
    border-right: 1px solid #d1d5db;
  }

  :global(.dark) .username-prefix {
    background: #0f172a;
    color: #9ca3af;
    border-right-color: #374151;
  }

  .username-input-wrapper .field-input {
    border: none;
    box-shadow: none;
    border-radius: 0;
    flex: 1;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }

  .username-input-wrapper .field-input:focus {
    box-shadow: none;
  }

  .field-error {
    font-size: 0.75rem;
    color: #ef4444;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .primary-button {
    padding: 0.5rem 1.25rem;
    background: #FE795D;
    color: white;
    border: 1px solid #FE795D;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .primary-button:hover:not(:disabled) {
    background: #EF562F;
  }

  .primary-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
    width: 100%;
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

  :global(.info-icon) {
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

  :global(.dark) .divider {
    background: #374151;
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

<script>
  import { onMount } from 'svelte';
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { verifyRecoveryLink, updatePassword } from '$lib/authStore';
  import { friendlyAuthError } from '$lib/authErrors';
  import { supabaseBrowser } from '$lib/supabaseBrowser';
  import { toast } from '$lib/toastStore';
  import Eye from 'phosphor-svelte/lib/Eye';
  import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
  import XCircle from 'phosphor-svelte/lib/XCircle';
  let status = 'verifying'; // verifying, form, invalid
  let linkError = '';
  let password = '';
  let confirmPassword = '';
  let showPassword = false;
  let loading = false;
  let error = null;

  onMount(async () => {
    const params = $page.url.searchParams;
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    const code = params.get('code');

    // A link Supabase already rejected (expired, reused) comes back as error=…,
    // in the query for PKCE redirects and in the fragment otherwise
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const rejected = params.get('error') ? params : hash.get('error') ? hash : null;
    if (rejected) {
      status = 'invalid';
      linkError = friendlyAuthError(
        { code: rejected.get('error_code'), message: rejected.get('error_description') },
        'This reset link is invalid.'
      );
      return;
    }

    if (code || (tokenHash && type === 'recovery')) {
      const result = await verifyRecoveryLink({ tokenHash, type, code });
      if (result.error) {
        status = 'invalid';
        linkError = friendlyAuthError(result.error, 'This reset link is invalid.');
        return;
      }
      // Drop the single-use token so a refresh doesn't try to spend it again
      replaceState('/reset-password', {});
      status = 'form';
      return;
    }

    // No link: allowed only with a session (signed in, or refreshed after verifying)
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (session) {
      status = 'form';
    } else {
      status = 'invalid';
      linkError = 'This page needs a password reset link. Request one below.';
    }
  });

  function validateForm() {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    error = null;

    const validationError = validateForm();
    if (validationError) {
      error = validationError;
      return;
    }

    loading = true;

    const result = await updatePassword(password);

    if (result.error) {
      error = friendlyAuthError(result.error, 'Failed to update password. Please try again.');
      loading = false;
    } else {
      toast.success('Password updated');
      goto('/');
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<svelte:head>
  <title>Choose a New Password - CartoTaco</title>
</svelte:head>

<div class="auth-container">
  <div class="auth-card">
    {#if status === 'verifying'}
      <div class="status-content">
        <div class="spinner"></div>
        <h1 class="title">Checking your reset link...</h1>
        <p class="subtitle">Please wait a moment</p>
      </div>
    {:else if status === 'invalid'}
      <div class="status-content">
        {#if browser}
          <XCircle size={56} weight="fill" class="error-icon" />
        {/if}
        <h1 class="title">Reset link not valid</h1>
        <p class="subtitle">{linkError}</p>
        <a href="/forgot-password" class="submit-button link-button">Request a new link</a>
      </div>
    {:else}
      <div class="header">
        <img src="/color_light_bg.png" alt="CartoTaco Logo" class="logo" />
        <h1 class="title">Choose a new password</h1>
        <p class="subtitle">You'll stay signed in once it's saved</p>
      </div>

      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}

      <form on:submit={handleSubmit} class="form">
        <div class="input-group">
          <label for="password" class="label">New Password</label>
          <div class="input-wrapper">
            {#if showPassword}
              <input
                id="password"
                type="text"
                bind:value={password}
                placeholder="••••••••"
                class="input with-icon-right"
                autocomplete="new-password"
                disabled={loading}
                required
              />
            {:else}
              <input
                id="password"
                type="password"
                bind:value={password}
                placeholder="••••••••"
                class="input with-icon-right"
                autocomplete="new-password"
                disabled={loading}
                required
              />
            {/if}
            <button
              type="button"
              class="password-toggle"
              on:click={togglePasswordVisibility}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {#if browser}
                {#if showPassword}
                  <EyeSlash size={16} />
                {:else}
                  <Eye size={16} />
                {/if}
              {/if}
            </button>
          </div>
          <p class="hint">Must be at least 6 characters</p>
        </div>

        <div class="input-group">
          <label for="confirm-password" class="label">Confirm New Password</label>
          <input
            id="confirm-password"
            type="password"
            bind:value={confirmPassword}
            placeholder="••••••••"
            class="input"
            autocomplete="new-password"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          class="submit-button"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save New Password'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .auth-container {
    min-height: calc(100vh - 60px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo {
    height: 60px;
    width: auto;
    margin-bottom: 1rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #6B7280;
  }

  .status-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
  }

  .status-content :global(.error-icon) {
    color: #EF4444;
    margin-bottom: 0.5rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #FFE4DE;
    border-top-color: #FE795D;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    padding: 0.75rem;
    background: #FEE2E2;
    border: 1px solid #FCA5A5;
    border-radius: 0.375rem;
    color: #991B1B;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #D1D5DB;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .input.with-icon-right {
    padding-right: 2.5rem;
  }

  .input:focus {
    outline: none;
    border-color: #FE795D;
    box-shadow: 0 0 0 3px rgba(254, 121, 93, 0.1);
  }

  .input:disabled {
    background: #F3F4F6;
    cursor: not-allowed;
  }

  .password-toggle {
    position: absolute;
    right: 0.75rem;
    background: transparent;
    border: none;
    color: #9CA3AF;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
  }

  .password-toggle:hover {
    color: #FE795D;
  }

  .hint {
    font-size: 0.75rem;
    color: #6B7280;
    margin-top: -0.25rem;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
  }

  .submit-button:hover:not(:disabled) {
    background: #EF562F;
  }

  .submit-button:disabled {
    background: #FCA5A5;
    cursor: not-allowed;
  }

  .link-button {
    display: block;
    text-align: center;
    text-decoration: none;
    margin-top: 1rem;
  }
</style>

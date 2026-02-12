<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { supabaseBrowser } from '$lib/supabaseBrowser';
  import { CheckCircleOutline, CloseCircleOutline } from 'flowbite-svelte-icons';

  let status = 'loading'; // loading, success, error
  let errorMessage = '';

  onMount(async () => {
    // Get token_hash and type from URL params
    const tokenHash = $page.url.searchParams.get('token_hash');
    const type = $page.url.searchParams.get('type');

    if (!tokenHash || type !== 'email') {
      status = 'error';
      errorMessage = 'Invalid confirmation link';
      return;
    }

    try {
      // Verify the email confirmation token
      const { error } = await supabaseBrowser.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email'
      });

      if (error) {
        status = 'error';
        errorMessage = error.message || 'Failed to confirm email';
      } else {
        status = 'success';
        // Redirect to home after success
        setTimeout(() => {
          goto('/');
        }, 2000);
      }
    } catch (err) {
      status = 'error';
      errorMessage = 'An unexpected error occurred';
      console.error('Email confirmation error:', err);
    }
  });
</script>

<svelte:head>
  <title>Confirm Email - CartoTaco</title>
</svelte:head>

<div class="confirm-container">
  <div class="confirm-card">
    {#if status === 'loading'}
      <div class="status-content">
        <div class="spinner"></div>
        <h1 class="title">Confirming your email...</h1>
        <p class="subtitle">Please wait a moment</p>
      </div>
    {:else if status === 'success'}
      <div class="status-content">
        {#if browser}
          <CheckCircleOutline class="success-icon" size="xl" />
        {/if}
        <h1 class="title">Email confirmed!</h1>
        <p class="subtitle">Your email has been successfully verified.</p>
        <p class="redirect-text">Redirecting you to CartoTaco...</p>
      </div>
    {:else if status === 'error'}
      <div class="status-content">
        {#if browser}
          <CloseCircleOutline class="error-icon" size="xl" />
        {/if}
        <h1 class="title">Confirmation failed</h1>
        <p class="subtitle">{errorMessage}</p>
        <div class="actions">
          <a href="/login" class="button">Go to Login</a>
          <a href="/" class="button secondary">Go Home</a>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .confirm-container {
    min-height: calc(100vh - 60px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
  }

  .confirm-card {
    width: 100%;
    max-width: 400px;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 3rem 2rem;
  }

  .status-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #FFE4DE;
    border-top-color: #FE795D;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .success-icon {
    color: #059669;
  }

  .error-icon {
    color: #DC2626;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #6B7280;
  }

  .redirect-text {
    font-size: 0.75rem;
    color: #9CA3AF;
    margin-top: 0.5rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    margin-top: 1rem;
  }

  .button {
    padding: 0.75rem 1.5rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .button:hover {
    background: #EF562F;
  }

  .button.secondary {
    background: transparent;
    color: #374151;
    border: 1px solid #D1D5DB;
  }

  .button.secondary:hover {
    background: #F9FAFB;
    border-color: #FE795D;
    color: #FE795D;
  }
</style>

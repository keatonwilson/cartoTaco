<script>
  import { requestPasswordReset } from '$lib/authStore';
  import { friendlyAuthError } from '$lib/authErrors';
  import { browser } from '$app/environment';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  let email = '';
  let loading = false;
  let error = null;
  let sent = false;

  function validateForm() {
    if (!email) {
      return 'Email is required';
    }
    if (!email.includes('@')) {
      return 'Please enter a valid email address';
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

    const result = await requestPasswordReset(email.trim());

    if (result.error) {
      error = friendlyAuthError(result.error, 'Failed to send reset email. Please try again.');
    } else {
      sent = true;
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>Reset Password - CartoTaco</title>
</svelte:head>

<div class="auth-container">
  <div class="auth-card">
    <div class="header">
      <img src="/color_light_bg.png" alt="CartoTaco Logo" class="logo" />
      <h1 class="title">Forgot your password?</h1>
      <p class="subtitle">Enter your email and we'll send you a link to choose a new one</p>
    </div>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    {#if sent}
      <div class="success-message">
        {#if browser}
          <CheckCircle size={20} class="success-icon" />
        {/if}
        <div>
          <p class="success-title">Check your email!</p>
          <p class="success-subtitle">If <strong>{email}</strong> has a CartoTaco account, a reset link is on its way. It expires in an hour.</p>
        </div>
      </div>
    {:else}
      <form on:submit={handleSubmit} class="form">
        <div class="input-group">
          <label for="email" class="label">Email</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            class="input"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          class="submit-button"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    {/if}

    <div class="footer">
      <p class="footer-text">
        Remembered it?
        <a href="/login" class="link">Back to sign in</a>
      </p>
    </div>
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

  .error-message {
    padding: 0.75rem;
    background: #FEE2E2;
    border: 1px solid #FCA5A5;
    border-radius: 0.375rem;
    color: #991B1B;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .success-message {
    padding: 1rem;
    background: #D1FAE5;
    border: 1px solid #6EE7B7;
    border-radius: 0.375rem;
    color: #065F46;
    font-size: 0.875rem;
    display: flex;
    gap: 0.75rem;
    align-items: start;
  }

  .success-message :global(.success-icon) {
    flex-shrink: 0;
    color: #059669;
  }

  .success-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .success-subtitle {
    font-size: 0.75rem;
    color: #047857;
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

  .input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #D1D5DB;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: all 0.2s;
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

  .footer {
    margin-top: 1.5rem;
    text-align: center;
  }

  .footer-text {
    font-size: 0.875rem;
    color: #6B7280;
  }

  .link {
    color: #FE795D;
    font-weight: 600;
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }
</style>

<script>
  import { signIn } from '$lib/authStore';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { EnvelopeOutline, EyeOutline, EyeSlashOutline } from 'flowbite-svelte-icons';

  let email = '';
  let password = '';
  let showPassword = false;
  let loading = false;
  let error = null;

  function validateForm() {
    if (!email) {
      return 'Email is required';
    }
    if (!email.includes('@')) {
      return 'Please enter a valid email address';
    }
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
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

    const result = await signIn(email, password);

    if (result.error) {
      error = result.error.message || 'Failed to sign in. Please check your credentials.';
      loading = false;
    } else {
      // Successfully signed in, redirect to home
      goto('/');
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<svelte:head>
  <title>Login - CartoTaco</title>
</svelte:head>

<div class="login-container">
  <div class="login-card">
    <div class="header">
      <img src="/color_light_bg.png" alt="CartoTaco Logo" class="logo" />
      <h1 class="title">Welcome Back</h1>
      <p class="subtitle">Sign in to your CartoTaco account</p>
    </div>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    <form on:submit={handleSubmit} class="form">
      <!-- Email Input -->
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

      <!-- Password Input -->
      <div class="input-group">
        <label for="password" class="label">Password</label>
        <div class="input-wrapper">
          {#if showPassword}
            <input
              id="password"
              type="text"
              bind:value={password}
              placeholder="••••••••"
              class="input with-icon-right"
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
                <EyeSlashOutline size="sm" />
              {:else}
                <EyeOutline size="sm" />
              {/if}
            {/if}
          </button>
        </div>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        class="submit-button"
        disabled={loading}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>

    <div class="footer">
      <p class="footer-text">
        Don't have an account?
        <a href="/signup" class="link">Sign up</a>
      </p>
    </div>
  </div>
</div>

<style>
  .login-container {
    min-height: calc(100vh - 60px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
  }

  .login-card {
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

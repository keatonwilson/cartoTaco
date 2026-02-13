<script>
  import { signUp } from '$lib/authStore';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { EnvelopeOutline, EyeOutline, EyeSlashOutline, CheckCircleOutline } from 'flowbite-svelte-icons';

  let email = '';
  let password = '';
  let confirmPassword = '';
  let showPassword = false;
  let showConfirmPassword = false;
  let loading = false;
  let error = null;
  let success = false;

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
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    error = null;
    success = false;

    const validationError = validateForm();
    if (validationError) {
      error = validationError;
      return;
    }

    loading = true;

    const result = await signUp(email, password);

    if (result.error) {
      error = result.error.message || 'Failed to create account. Please try again.';
      loading = false;
    } else {
      // Successfully signed up
      success = true;
      loading = false;

      // Redirect to home after a brief delay
      setTimeout(() => {
        goto('/');
      }, 1500);
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function toggleConfirmPasswordVisibility() {
    showConfirmPassword = !showConfirmPassword;
  }
</script>

<svelte:head>
  <title>Sign Up - CartoTaco</title>
</svelte:head>

<div class="signup-container">
  <div class="signup-card">
    <div class="header">
      <img src="/color_light_bg.png" alt="CartoTaco Logo" class="logo" />
      <h1 class="title">Join CartoTaco</h1>
      <p class="subtitle">Create your account to get started</p>
    </div>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    {#if success}
      <div class="success-message">
        {#if browser}
          <CheckCircleOutline class="success-icon" />
        {/if}
        <div>
          <p class="success-title">Account created successfully!</p>
          <p class="success-subtitle">Redirecting you to CartoTaco...</p>
        </div>
      </div>
    {/if}

    {#if !success}
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
          <p class="hint">Must be at least 6 characters</p>
        </div>

        <!-- Confirm Password Input -->
        <div class="input-group">
          <label for="confirm-password" class="label">Confirm Password</label>
          <div class="input-wrapper">
            {#if showConfirmPassword}
              <input
                id="confirm-password"
                type="text"
                bind:value={confirmPassword}
                placeholder="••••••••"
                class="input with-icon-right"
                disabled={loading}
                required
              />
            {:else}
              <input
                id="confirm-password"
                type="password"
                bind:value={confirmPassword}
                placeholder="••••••••"
                class="input with-icon-right"
                disabled={loading}
                required
              />
            {/if}
            <button
              type="button"
              class="password-toggle"
              on:click={toggleConfirmPasswordVisibility}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {#if browser}
                {#if showConfirmPassword}
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
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    {/if}

    <div class="footer">
      <p class="footer-text">
        Already have an account?
        <a href="/login" class="link">Sign in</a>
      </p>
    </div>
  </div>
</div>

<style>
  .signup-container {
    min-height: calc(100vh - 60px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: linear-gradient(135deg, #FFF5F2 0%, #FFE4DE 100%);
  }

  .signup-card {
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
    margin-bottom: 1.5rem;
    display: flex;
    gap: 0.75rem;
    align-items: start;
  }

  .success-icon {
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
    padding-left: 0.75rem;
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

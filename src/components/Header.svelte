<script>
	import { isAuthenticated, currentUser, signOut } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { BarsOutline, CloseOutline, UserCircleOutline } from 'flowbite-svelte-icons';
	import ThemeToggle from './ThemeToggle.svelte';
	import NewSpotsBadge from './NewSpotsBadge.svelte';

	let mobileMenuOpen = false;

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  async function handleSignOut() {
    await signOut();
    closeMobileMenu();
    goto('/');
  }

  function handleNavigation(path) {
    closeMobileMenu();
    goto(path);
  }
</script>

<header class="header">
  <div class="header-container">
    <!-- Logo -->
    <a href="/" class="logo-link" on:click={closeMobileMenu}>
      <img
        src="/color_light_bg.png"
        alt="CartoTaco Logo"
        class="logo-image"
      />
    </a>

    <!-- Desktop Navigation -->
    <nav class="desktop-nav">
			<ThemeToggle />
			<NewSpotsBadge on:spotSelected={closeMobileMenu} />
      {#if $isAuthenticated}
        <div class="user-info">
          {#if browser}
            <UserCircleOutline class="user-icon" />
          {/if}
          <span class="user-email">{$currentUser?.email}</span>
        </div>
        <button
          class="nav-link"
          on:click={() => handleNavigation('/submit')}
        >
          Submit Location
        </button>
        <button
          class="nav-link"
          on:click={() => handleNavigation('/favorites')}
        >
          Favorites
        </button>
        <button
          class="nav-link"
          on:click={() => handleNavigation('/profile')}
        >
          Profile
        </button>
        <button
          class="nav-link sign-out"
          on:click={handleSignOut}
        >
          Sign Out
        </button>
      {:else}
        <button
          class="nav-link"
          on:click={() => handleNavigation('/login')}
        >
          Login
        </button>
        <div class="signup-wrapper">
          <button
            class="nav-link signup"
            on:click={() => handleNavigation('/signup')}
          >
            Sign Up
          </button>
          <div class="tooltip">
            <div class="tooltip-title">Join CartoTaco!</div>
            <ul class="tooltip-list">
              <li>Save your favorite spots</li>
              <li>Rate & review tacos</li>
              <li>Submit new locations</li>
            </ul>
          </div>
        </div>
      {/if}
    </nav>

    <!-- Mobile Menu Button -->
    <button
      class="mobile-menu-button"
      on:click={toggleMobileMenu}
      aria-label="Toggle menu"
    >
      {#if browser}
        {#if mobileMenuOpen}
          <CloseOutline size="lg" />
        {:else}
          <BarsOutline size="lg" />
        {/if}
      {/if}
    </button>
  </div>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div class="mobile-menu">
			<div class="mobile-theme-toggle">
				<ThemeToggle />
				<NewSpotsBadge on:spotSelected={closeMobileMenu} />
			</div>
      {#if $isAuthenticated}
        <div class="mobile-user-info">
          {#if browser}
            <UserCircleOutline class="user-icon" />
          {/if}
          <span class="user-email">{$currentUser?.email}</span>
        </div>
        <button
          class="mobile-nav-link"
          on:click={() => handleNavigation('/submit')}
        >
          Submit Location
        </button>
        <button
          class="mobile-nav-link"
          on:click={() => handleNavigation('/favorites')}
        >
          Favorites
        </button>
        <button
          class="mobile-nav-link"
          on:click={() => handleNavigation('/profile')}
        >
          Profile
        </button>
        <button
          class="mobile-nav-link"
          on:click={handleSignOut}
        >
          Sign Out
        </button>
      {:else}
        <button
          class="mobile-nav-link"
          on:click={() => handleNavigation('/login')}
        >
          Login
        </button>
        <button
          class="mobile-nav-link signup"
          on:click={() => handleNavigation('/signup')}
        >
          Sign Up
        </button>
      {/if}
    </div>
  {/if}
</header>

<style>
  .header {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.35) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border-bottom: 2px solid rgba(254, 121, 93, 0.5);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
    z-index: 9999;
  }

  .header-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .logo-image {
    height: 40px;
    width: auto;
  }

  /* Desktop Navigation */
  .desktop-nav {
    display: none;
    align-items: center;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .desktop-nav {
      display: flex;
    }
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #374151;
    font-size: 0.875rem;
    margin-right: 0.5rem;
  }

  .user-icon {
    color: #FE795D;
  }

  .user-email {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-link {
    padding: 0.5rem 1rem;
    color: #374151;
    background: transparent;
    border: 1px solid #E5E7EB;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .nav-link:hover {
    background: #F9FAFB;
    border-color: #FE795D;
    color: #FE795D;
  }

  .nav-link.signup {
    background: #FE795D;
    color: white;
    border-color: #FE795D;
  }

  .nav-link.signup:hover {
    background: #EF562F;
    border-color: #EF562F;
    color: white;
  }

  .signup-wrapper {
    position: relative;
  }

  .tooltip {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    background: white;
    border: 2px solid #FE795D;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 220px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    z-index: 2000;
  }

  .signup-wrapper:hover .tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .tooltip::before {
    content: '';
    position: absolute;
    top: -8px;
    right: 20px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid #FE795D;
  }

  .tooltip-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #FE795D;
    margin-bottom: 0.5rem;
  }

  .tooltip-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .tooltip-list li {
    font-size: 0.8rem;
    color: #374151;
    padding: 0.25rem 0;
    padding-left: 1.25rem;
    position: relative;
  }

  .tooltip-list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: #FE795D;
    font-weight: bold;
  }

  .nav-link.sign-out {
    border-color: #DC2626;
    color: #DC2626;
  }

  .nav-link.sign-out:hover {
    background: #DC2626;
    color: white;
  }

  /* Mobile Menu Button */
  .mobile-menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: #FE795D;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  @media (min-width: 768px) {
    .mobile-menu-button {
      display: none;
    }
  }

  /* Mobile Menu */
  .mobile-menu {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.35);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(229, 231, 235, 0.5);
  }

  @media (min-width: 768px) {
    .mobile-menu {
      display: none;
    }
  }

  .mobile-user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #F9FAFB;
    border-radius: 0.375rem;
    color: #374151;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .mobile-nav-link {
    padding: 0.75rem 1rem;
    color: #374151;
    background: transparent;
    border: 1px solid #E5E7EB;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .mobile-nav-link:active {
    background: #F9FAFB;
  }

  .mobile-nav-link.signup {
    background: #FE795D;
    color: white;
    border-color: #FE795D;
  }

  .mobile-nav-link.signup:active {
    background: #EF562F;
  }

	.mobile-theme-toggle {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
</style>

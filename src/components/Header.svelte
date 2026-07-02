<script>
	import { isAuthenticated, currentUser, signOut } from '$lib/authStore';
	import { getOwnProfile } from '$lib/profiles';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import List from 'phosphor-svelte/lib/List';
	import X from 'phosphor-svelte/lib/X';
	import UserCircle from 'phosphor-svelte/lib/UserCircle';
	import Question from 'phosphor-svelte/lib/Question';
	import Ranking from 'phosphor-svelte/lib/Ranking';
	import ChartBar from 'phosphor-svelte/lib/ChartBar';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { fly } from 'svelte/transition';
	import ThemeToggle from './ThemeToggle.svelte';
	import NewSpotsBadge from './NewSpotsBadge.svelte';
	import { startTour } from '$lib/tourStore.js';
	import { mobileNavOpen } from '$lib/uiStore.js';
	import { selectedSite } from '$lib/stores.js';

  function toggleMobileMenu() {
    const opening = !$mobileNavOpen;
    mobileNavOpen.update(v => !v);
    // Close the bottom sheet when the nav menu opens
    if (opening) selectedSite.set(null);
  }

  function closeMobileMenu() {
    mobileNavOpen.set(false);
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

  // Desktop user menu
  let userMenuOpen = false;
  let userMenuEl;

  // Profile identity for the menu button (username + avatar); falls back to
  // the email local-part and a generic icon until the profile loads
  let profileName = null;
  let profileAvatarUrl = null;

  async function loadProfileIdentity() {
    try {
      const result = await getOwnProfile();
      if (result.success && result.data) {
        profileName = result.data.username || result.data.display_name || null;
        profileAvatarUrl = result.data.avatar_url || null;
      }
    } catch {
      // fall back to email local-part
    }
  }

  $: if ($isAuthenticated) {
    loadProfileIdentity();
  } else {
    profileName = null;
    profileAvatarUrl = null;
  }

  $: menuDisplayName = profileName || $currentUser?.email?.split('@')[0] || 'Account';

  function toggleUserMenu() {
    userMenuOpen = !userMenuOpen;
  }

  function handleMenuNavigation(path) {
    userMenuOpen = false;
    goto(path);
  }

  async function handleMenuSignOut() {
    userMenuOpen = false;
    await signOut();
    goto('/');
  }

  function handleWindowClick(event) {
    if (userMenuOpen && userMenuEl && !userMenuEl.contains(event.target)) {
      userMenuOpen = false;
    }
  }
</script>

<svelte:window on:click={handleWindowClick} />

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
			<NewSpotsBadge on:spotSelected={closeMobileMenu} on:panelOpened={closeMobileMenu} />
			<button class="help-button" on:click={startTour} title="Take a tour" aria-label="Take a tour">
				{#if browser}<Question size={16} />{/if}
			</button>
      <button
        class="nav-link summit-link"
        data-tour="summit"
        on:click={() => handleNavigation('/vote/new')}
        title="Start a group vote on where to eat"
      >
        <Ranking size={16} weight="duotone" />
        Summit
      </button>
      <button
        class="nav-link"
        on:click={() => handleNavigation('/census')}
        title="City-wide taco statistics"
      >
        <ChartBar size={16} weight="duotone" />
        Census
      </button>

      {#if $isAuthenticated}
        <!-- User menu: consolidates account actions behind one control -->
        <div class="user-menu-wrapper" bind:this={userMenuEl}>
          <button
            class="user-menu-button"
            on:click={toggleUserMenu}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            {#if profileAvatarUrl}
              <img class="user-avatar" src={profileAvatarUrl} alt="" />
            {:else if browser}
              <UserCircle size={22} weight="duotone" class="user-icon" />
            {/if}
            <span class="user-name">{menuDisplayName}</span>
            {#if browser}<CaretDown size={12} />{/if}
          </button>
          {#if userMenuOpen}
            <div class="user-dropdown" role="menu" transition:fly={{ y: -6, duration: 150 }}>
              <button role="menuitem" on:click={() => handleMenuNavigation('/submit')}>
                Submit Location
              </button>
              <button role="menuitem" on:click={() => handleMenuNavigation('/favorites')}>
                Favorites
              </button>
              <button role="menuitem" on:click={() => handleMenuNavigation('/profile')}>
                Profile
              </button>
              <div class="dropdown-divider"></div>
              <button role="menuitem" class="dropdown-signout" on:click={handleMenuSignOut}>
                Sign Out
              </button>
            </div>
          {/if}
        </div>
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

    <!-- Mobile-only controls (always visible in header bar) -->
    <div class="mobile-header-controls">
      <ThemeToggle />
      <NewSpotsBadge on:spotSelected={closeMobileMenu} />
      <button class="help-button" on:click={startTour} title="Take a tour" aria-label="Take a tour">
        {#if browser}<Question size={16} />{/if}
      </button>
    </div>

    <!-- Mobile Menu Button -->
    <button
      class="mobile-menu-button"
      on:click={toggleMobileMenu}
      aria-label="Toggle menu"
    >
      {#if browser}
        {#if $mobileNavOpen}
          <X size={24} />
        {:else}
          <List size={24} />
        {/if}
      {/if}
    </button>
  </div>

  <!-- Mobile Menu -->
  {#if $mobileNavOpen}
    <div class="mobile-menu">
      <button
        class="mobile-nav-link summit-link"
        on:click={() => handleNavigation('/vote/new')}
      >
        <Ranking size={16} weight="duotone" />
        Summit — group vote
      </button>
      <button
        class="mobile-nav-link"
        on:click={() => handleNavigation('/census')}
      >
        <ChartBar size={16} weight="duotone" />
        Taco Census
      </button>
      {#if $isAuthenticated}
        <div class="mobile-user-info">
          {#if browser}
            <UserCircle size={20} class="user-icon" />
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

  :global(.dark) .header {
    background: rgba(10, 14, 26, 0.82) !important;
    border-bottom-color: rgba(254, 121, 93, 0.35);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
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
    border-radius: 8px;
    transition: box-shadow 0.3s ease, background 0.3s ease;
  }

  :global(.dark) .logo-image {
    background: rgba(255, 255, 255, 0.18);
    padding: 4px 8px;
    box-shadow:
      0 0 10px rgba(254, 121, 93, 0.8),
      0 0 28px rgba(254, 121, 93, 0.4),
      inset 0 0 0 1px rgba(254, 121, 93, 0.4);
  }

  /* Desktop Navigation */
  .desktop-nav {
    display: none;
    align-items: center;
    gap: 1rem;
  }

  /* Show desktop nav only when there's room for all 8+ items.
     Below this, fall back to the hamburger menu — iPad portrait (834px)
     and split-view widths land here. */
  @media (min-width: 1100px) {
    .desktop-nav {
      display: flex;
    }
  }

  /* Desktop user menu */
  .user-menu-wrapper {
    position: relative;
  }

  .user-menu-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--line-1);
    border-radius: 999px;
    background: var(--surface-1);
    color: var(--ink-1);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .user-menu-button:hover {
    border-color: var(--accent);
  }

  .user-menu-button :global(.user-icon) {
    color: var(--accent);
  }

  .user-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .user-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 185px;
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    padding: 6px;
    display: flex;
    flex-direction: column;
    z-index: 10000;
  }

  :global(.dark) .user-dropdown {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  }

  .user-dropdown button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--ink-1);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .user-dropdown button:hover {
    background: var(--surface-3);
    color: var(--accent);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--line-1);
    margin: 4px 6px;
  }

  .dropdown-signout {
    color: var(--error) !important;
  }

  .dropdown-signout:hover {
    background: rgba(239, 68, 68, 0.08) !important;
    color: var(--error) !important;
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

  :global(.dark) .nav-link {
    color: #d1d5db;
    border-color: #374151;
  }

  .nav-link:hover {
    background: #F9FAFB;
    border-color: #FE795D;
    color: #FE795D;
  }

  :global(.dark) .nav-link:hover {
    background: rgba(255, 255, 255, 0.06);
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

  .nav-link.summit-link {
    border-color: rgba(254, 121, 93, 0.4);
    background: rgba(254, 121, 93, 0.06);
    font-weight: 600;
  }

  .nav-link.summit-link:hover {
    background: rgba(254, 121, 93, 0.14);
    border-color: #FE795D;
    color: #FE795D;
  }

  :global(.dark) .nav-link.summit-link {
    border-color: rgba(254, 121, 93, 0.3);
    background: rgba(254, 121, 93, 0.08);
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

  @media (min-width: 1100px) {
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

  :global(.dark) .mobile-menu {
    background: rgba(10, 14, 26, 0.92);
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  @media (min-width: 1100px) {
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

  :global(.dark) .mobile-user-info {
    background: rgba(255, 255, 255, 0.05);
    color: #d1d5db;
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

  :global(.dark) .mobile-nav-link {
    color: #d1d5db;
    border-color: #374151;
  }

  .mobile-nav-link:active {
    background: #F9FAFB;
  }

  :global(.dark) .mobile-nav-link:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .mobile-nav-link.signup {
    background: #FE795D;
    color: white;
    border-color: #FE795D;
  }

  .mobile-nav-link.signup:active {
    background: #EF562F;
  }

  /* Mobile-only controls in header bar */
  .mobile-header-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  @media (min-width: 1100px) {
    .mobile-header-controls {
      display: none;
    }
  }

  .help-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    background: transparent;
    border: 1px solid #E5E7EB;
    border-radius: 50%;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    width: 32px;
    height: 32px;
  }

  :global(.dark) .help-button {
    border-color: #374151;
    color: #9ca3af;
  }

  .help-button:hover {
    border-color: #FE795D;
    color: #FE795D;
    background: rgba(254, 121, 93, 0.1);
  }
</style>

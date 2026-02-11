import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Breakpoints matching FilterBar.svelte pattern (line 413)
const BREAKPOINTS = {
  mobile: 768,    // 0-767px
  tablet: 1024    // 768-1023px
  // desktop: 1024px+
};

// Create a writable store for screen width
function createScreenWidthStore() {
  const { subscribe, set } = writable(browser ? window.innerWidth : 1024);

  if (browser) {
    // Update on resize
    const handleResize = () => set(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // Cleanup
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        window.removeEventListener('resize', handleResize);
      });
    }
  }

  return { subscribe };
}

export const screenWidth = createScreenWidthStore();

// Derived store for device type
export const deviceType = derived(screenWidth, $width => {
  if ($width < BREAKPOINTS.mobile) return 'mobile';
  if ($width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
});

// Convenience computed values
export const isMobile = derived(deviceType, $type => $type === 'mobile');
export const isTablet = derived(deviceType, $type => $type === 'tablet');
export const isDesktop = derived(deviceType, $type => $type === 'desktop');

/**
 * iOS Safari "scroll runway" for the full-screen map (issue #99).
 *
 * iOS 26 Safari never draws position: fixed content below its toolbar (by
 * design, WebKit bug 297779), and draws page content behind its toolbars only
 * once the page has scrolled; at scrollY 0 it fills them with a flat colour.
 * So on iOS the map is page content, taller than the visible area by `bleed`
 * (the strip under the toolbar and home indicator), and the page sits
 * scrolled down by `offset`. See static/viewport-test.html for the probe.
 */

export const RUNWAY_OFFSET = 1;

// -webkit-touch-callout exists only in iOS/iPadOS WebKit
const isIOS = () => typeof CSS !== 'undefined' && CSS.supports('-webkit-touch-callout', 'none');

/** Everything between the visible area's bottom and the screen's, in px. */
function bleed() {
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  // ponytail: screen height - innerHeight also counts the status bar, so this
  // overshoots by ~60px; harmless, the extra map just sits off-screen
  return Math.max(0, (innerWidth < innerHeight ? long : short) - innerHeight);
}

/** Size the runway and scroll onto it. Returns a cleanup function. */
export function startRunway() {
  if (typeof window === 'undefined' || !isIOS()) return () => {};
  const root = document.documentElement;
  let timer;

  const apply = () => {
    root.style.setProperty('--runway-top', `${RUNWAY_OFFSET}px`);
    root.style.setProperty('--runway-bottom', `${bleed()}px`);
    requestAnimationFrame(() => {
      if (scrollY < RUNWAY_OFFSET) scrollTo({ top: RUNWAY_OFFSET, behavior: 'instant' });
    });
  };
  // Back at the very top Safari reverts to the flat fill; step back onto the runway
  const onScroll = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (scrollY < RUNWAY_OFFSET) scrollTo({ top: RUNWAY_OFFSET, behavior: 'instant' });
    }, 150);
  };
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 150);
  };

  apply();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  return () => {
    clearTimeout(timer);
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onResize);
    root.style.removeProperty('--runway-top');
    root.style.removeProperty('--runway-bottom');
  };
}

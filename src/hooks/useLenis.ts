/**
 * Native compositor-threaded scrolling helper.
 * Removes perpetual requestAnimationFrame wheel hijacking for zero scroll lag across all devices.
 */
export function scrollPageToTop() {
  if (typeof window === 'undefined') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

export function useLenis() {
  // Intentionally delegates to native browser scrolling for maximum 60/120fps responsiveness.
}

import { useEffect } from 'react';
import Lenis from 'lenis';

let activeLenis: Lenis | null = null;

export function scrollPageToTop() {
  if (activeLenis) {
    activeLenis.scrollTo(0, { duration: 0.85 });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Desktop-focused Lenis smooth scrolling.
 * Automatically disables on touch devices and when prefers-reduced-motion is active.
 */
export function useLenis() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFinePointer || prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1,
      prevent: (node) => Boolean(node.closest('[data-lenis-prevent], .sidebar-scroll')),
    });
    activeLenis = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      activeLenis = null;
      lenis.destroy();
    };
  }, []);
}

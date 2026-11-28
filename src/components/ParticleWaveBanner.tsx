import React, { useEffect, useRef } from 'react';

interface StarParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  phase: number;
  color: string;
}

/**
 * Optimized Luminous 3D Dotted Particle Wave Banner
 * Batches row draw calls, caps DPR at 1.5, throttles smoothly to ~30fps,
 * and completely cancels requestAnimationFrame when scrolled offscreen or tab is hidden.
 */
export const ParticleWaveBanner: React.FC = React.memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = container.clientWidth || 960;
    let height = container.clientHeight || 320;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let bgGrad: CanvasGradient | null = null;
    let glowGrad: CanvasGradient | null = null;

    const rebuildGradients = () => {
      bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#140928');
      bgGrad.addColorStop(0.52, '#1A0D35');
      bgGrad.addColorStop(1, '#0E061E');

      glowGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.58,
        10,
        width * 0.5,
        height * 0.58,
        width * 0.58
      );
      glowGrad.addColorStop(0, 'rgba(124, 58, 237, 0.24)');
      glowGrad.addColorStop(0.5, 'rgba(91, 33, 182, 0.09)');
      glowGrad.addColorStop(1, 'rgba(14, 6, 30, 0)');
    };

    const resize = () => {
      width = Math.max(container.clientWidth, 320);
      height = Math.max(container.clientHeight, 260);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGradients();
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const starColors = [
      'rgba(216, 180, 254, 0.85)',
      'rgba(167, 139, 250, 0.78)',
      'rgba(244, 180, 212, 0.72)',
      'rgba(191, 219, 254, 0.75)',
    ];
    const stars: StarParticle[] = Array.from({ length: 36 }, (_, i) => ({
      x: ((i * 73.13) % 100) / 100,
      y: ((i * 41.77 + 11) % 100) / 100,
      size: 1.5 + (i % 3) * 0.7,
      speedX: (i % 2 === 0 ? 1 : -1) * (0.002 + (i % 5) * 0.0008),
      speedY: -0.0018 - (i % 3) * 0.0007,
      phase: i * 0.9,
      color: starColors[i % starColors.length],
    }));

    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const onPointerLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
    };

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });

    let rafId = 0;
    let isVisible = true;
    let isTabVisible = !document.hidden;
    const startTime = performance.now();
    let lastDraw = 0;
    const FRAME_MS = 33; // Smooth ~30fps cap — 50% less GPU/CPU overhead

    const drawFrame = (now: number) => {
      const t = reducedMotion ? 1.8 : (now - startTime) * 0.001;

      mouseX += (targetMouseX - mouseX) * 0.06;
      mouseY += (targetMouseY - mouseY) * 0.06;

      if (bgGrad) {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }
      if (glowGrad) {
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 1. Ambient cosmic stardust specks (fast fillRect)
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const sx = (((s.x + t * s.speedX) % 1) + 1) % 1;
        const sy = (((s.y + t * s.speedY) % 1) + 1) % 1;
        ctx.globalAlpha = (0.45 + 0.55 * Math.sin(t * 1.4 + s.phase)) * 0.85;
        ctx.fillStyle = s.color;
        ctx.fillRect(sx * width, sy * height, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // 2. Secondary counter-flowing soft wave ribbon (batched per row)
      const secCols = width < 640 ? 46 : 74;
      const secRows = 6;
      const baseSecY = height * 0.67 + mouseY * 5;

      for (let r = 0; r < secRows; r += 1) {
        const rowNorm = r / (secRows - 1);
        const depthAlpha = (1 - Math.abs(rowNorm - 0.35) * 1.15) * 0.34;
        if (depthAlpha <= 0.03) continue;

        ctx.fillStyle = `rgba(139, 92, 246, ${depthAlpha.toFixed(2)})`;
        const dotSize = 1.4 + (1 - rowNorm) * 0.8;
        const rowOffset = (rowNorm - 0.5) * (height * 0.16);

        for (let c = 0; c < secCols; c += 1) {
          const u = c / (secCols - 1);
          const x = u * (width + 20) - 10;
          const wave =
            Math.sin(u * 5.2 - t * 0.55 + rowNorm * 1.5) * (height * 0.085) +
            Math.cos(u * 9.1 + t * 0.35 - rowNorm * 2.1) * (height * 0.032);
          ctx.fillRect(x, baseSecY + wave + rowOffset, dotSize, dotSize);
        }
      }

      // 3. Primary 3D perspective dotted particle wave mesh (1 fillStyle per row!)
      const cols = width < 640 ? 58 : 96;
      const rows = width < 640 ? 12 : 17;
      const baseY = height * 0.56 + mouseY * 8;
      const crestX: number[] = [];
      const crestY: number[] = [];

      for (let r = rows - 1; r >= 0; r -= 1) {
        const rowNorm = r / (rows - 1);
        const depthFade = Math.pow(1 - rowNorm, 1.35);
        const crestBoost = r < 3 ? (3 - r) / 3 : 0;
        const alpha = Math.min(0.96, 0.12 + depthFade * 0.56 + crestBoost * 0.32);
        const dotSize = 1.5 + depthFade * 1.2 + crestBoost * 0.7;

        const red = Math.round(128 + crestBoost * 84);
        const green = Math.round(94 + crestBoost * 98);
        const blue = Math.round(245 + crestBoost * 10);
        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;

        const perspectiveSpread = 1 + (0.5 - rowNorm) * 0.08;
        const verticalRibbonSpread = (rowNorm - 0.15) * (height * 0.34);
        const mxShift = mouseX * (1 - rowNorm) * 8;

        for (let c = 0; c < cols; c += 1) {
          const u = c / (cols - 1);
          const x = (u - 0.5) * (width * 1.06) * perspectiveSpread + width * 0.5 + mxShift;
          const primaryWave =
            Math.sin(u * 4.4 + t * 0.62 + rowNorm * 2.2) * (height * 0.115) +
            Math.sin(u * 8.6 - t * 0.42 + rowNorm * 3.1) * (height * 0.044) +
            Math.cos(u * 2.3 + t * 0.28 - rowNorm * 1.4) * (height * 0.055);
          const y = baseY + primaryWave + verticalRibbonSpread;

          if (r === 0) {
            crestX.push(x);
            crestY.push(y);
          }
          ctx.fillRect(x - dotSize * 0.5, y - dotSize * 0.5, dotSize, dotSize);
        }
      }

      // 4. Lightweight double-stroke luminous crest halo (no expensive shadowBlur!)
      if (crestX.length > 2) {
        ctx.beginPath();
        ctx.moveTo(crestX[0], crestY[0]);
        for (let i = 1; i < crestX.length; i += 1) {
          ctx.lineTo(crestX[i], crestY[i]);
        }
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.20)';
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(216, 180, 254, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    };

    const stopLoop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const loop = (now: number) => {
      if (!isVisible || !isTabVisible || reducedMotion) {
        rafId = 0;
        return;
      }
      if (now - lastDraw >= FRAME_MS) {
        lastDraw = now;
        drawFrame(now);
      }
      rafId = window.requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (reducedMotion || !isVisible || !isTabVisible || rafId) return;
      rafId = window.requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? false;
        if (isVisible) startLoop();
        else stopLoop();
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) startLoop();
      else stopLoop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    drawFrame(performance.now());
    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <section aria-label="Toolivo tagline showcase">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-[#140928] shadow-[0_14px_40px_-18px_rgba(91,33,182,0.55)]"
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block h-[270px] w-full sm:h-[320px] lg:h-[360px]"
        />

        {/* Subtle radial contrast veil so the tagline stays razor-sharp over luminous crests */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_58%_at_50%_46%,rgba(16,8,34,0.56)_0%,rgba(16,8,34,0.16)_65%,transparent_100%)]"
        />

        {/* Centered Tagline in Noto Serif Ethiopic Condensed */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="font-mono text-xs font-medium tracking-wide text-violet-200/85">
            Toolivo · 100% Local Browser Suite
          </p>
          <h2 className="font-tagline mt-3 max-w-3xl text-3xl leading-[1.12] font-semibold tracking-tight text-balance text-white drop-shadow-[0_2px_22px_rgba(124,58,237,0.45)] sm:text-5xl lg:text-[54px]">
            Every Tool You Need. One Click Away.
          </h2>
          <p className="mt-3.5 max-w-xl text-xs leading-relaxed text-violet-100/80 sm:text-sm">
            43 PDF, video, audio &amp; photo utilities running directly in browser memory — zero uploads, zero watermarks.
          </p>
        </div>
      </div>
    </section>
  );
});

ParticleWaveBanner.displayName = 'ParticleWaveBanner';

import React, { useEffect, useRef } from 'react';

interface StarParticle {
  x: number;
  y: number;
  r: number;
  speedX: number;
  speedY: number;
  phase: number;
  color: string;
}

/**
 * Luminous 3D Dotted Particle Wave Banner
 * Inspired by flowing violet cosmic particle waves, displaying Toolivo's tagline
 * in Noto Serif Ethiopic Condensed over a 60fps HiDPI canvas.
 */
export const ParticleWaveBanner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = container.clientWidth || 960;
    let height = container.clientHeight || 340;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = Math.max(container.clientWidth, 320);
      height = Math.max(container.clientHeight, 260);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Subtle drifting ambient cosmic stardust particles
    const starColors = [
      'rgba(216, 180, 254, 0.85)',
      'rgba(167, 139, 250, 0.78)',
      'rgba(244, 180, 212, 0.72)',
      'rgba(191, 219, 254, 0.75)',
      'rgba(139, 92, 246, 0.65)',
    ];
    const stars: StarParticle[] = Array.from({ length: 56 }, (_, i) => ({
      x: ((i * 73.13) % 100) / 100,
      y: ((i * 41.77 + 11) % 100) / 100,
      r: 0.75 + (i % 4) * 0.42,
      speedX: (i % 2 === 0 ? 1 : -1) * (0.002 + (i % 5) * 0.0008),
      speedY: -0.0018 - (i % 3) * 0.0007,
      phase: i * 0.9,
      color: starColors[i % starColors.length],
    }));

    // Gentle pointer parallax
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

    let isVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    let rafId = 0;
    let startTime = performance.now();

    const drawFrame = (now: number) => {
      const t = reducedMotion ? 1.8 : (now - startTime) * 0.001;

      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // 1. Deep cosmic violet gradient field matching reference atmosphere
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#140928');
      bgGrad.addColorStop(0.52, '#1A0D35');
      bgGrad.addColorStop(1, '#0E061E');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric violet glow behind the wave ridge
      const glowGrad = ctx.createRadialGradient(
        width * (0.48 + mouseX * 0.04),
        height * 0.58,
        10,
        width * 0.5,
        height * 0.58,
        width * 0.58
      );
      glowGrad.addColorStop(0, 'rgba(124, 58, 237, 0.22)');
      glowGrad.addColorStop(0.5, 'rgba(91, 33, 182, 0.09)');
      glowGrad.addColorStop(1, 'rgba(14, 6, 30, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient drifting cosmic stardust specks
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const sx = (((s.x + t * s.speedX) % 1) + 1) % 1;
        const sy = (((s.y + t * s.speedY) % 1) + 1) % 1;
        const twinkle = 0.45 + 0.55 * Math.sin(t * 1.4 + s.phase);
        ctx.globalAlpha = twinkle * 0.85;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(sx * width, sy * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 3. Secondary counter-flowing soft wave ribbon underneath
      const secCols = width < 640 ? 78 : 128;
      const secRows = 10;
      const baseSecY = height * 0.67 + mouseY * 6;

      for (let r = 0; r < secRows; r += 1) {
        const rowNorm = r / (secRows - 1);
        const depthAlpha = (1 - Math.abs(rowNorm - 0.35) * 1.15) * 0.36;
        if (depthAlpha <= 0.03) continue;

        for (let c = 0; c < secCols; c += 1) {
          const u = c / (secCols - 1);
          const x = u * (width + 24) - 12;
          const wave =
            Math.sin(u * 5.2 - t * 0.55 + rowNorm * 1.5) * (height * 0.085) +
            Math.cos(u * 9.1 + t * 0.35 - rowNorm * 2.1) * (height * 0.032);
          const y = baseSecY + wave + (rowNorm - 0.5) * (height * 0.16);
          const dotSize = 0.7 + (1 - rowNorm) * 0.65;

          ctx.fillStyle = `rgba(139, 92, 246, ${depthAlpha.toFixed(3)})`;
          ctx.fillRect(x, y, dotSize, dotSize);
        }
      }

      // 4. Primary 3D perspective dotted particle wave mesh
      const cols = width < 640 ? 86 : 148;
      const rows = width < 640 ? 18 : 26;
      const baseY = height * 0.56 + mouseY * 10;

      // Store front-ridge points for soft luminous crest spline
      const crestPoints: { x: number; y: number }[] = [];

      for (let r = rows - 1; r >= 0; r -= 1) {
        const rowNorm = r / (rows - 1); // 0 = front luminous ridge, 1 = deep background fade
        const depthFade = Math.pow(1 - rowNorm, 1.35);

        for (let c = 0; c < cols; c += 1) {
          const u = c / (cols - 1);
          const perspectiveSpread = 1 + (0.5 - rowNorm) * 0.08;
          const x = (u - 0.5) * (width * 1.06) * perspectiveSpread + width * 0.5 + mouseX * (1 - rowNorm) * 10;

          // Multi-harmonic rolling hills matching the reference silhouette
          const primaryWave =
            Math.sin(u * 4.4 + t * 0.62 + rowNorm * 2.2) * (height * 0.115) +
            Math.sin(u * 8.6 - t * 0.42 + rowNorm * 3.1) * (height * 0.044) +
            Math.cos(u * 2.3 + t * 0.28 - rowNorm * 1.4) * (height * 0.055);

          const verticalRibbonSpread = (rowNorm - 0.15) * (height * 0.34);
          const y = baseY + primaryWave + verticalRibbonSpread;

          if (r === 0) {
            crestPoints.push({ x, y });
          }

          // Higher brightness & slightly larger radius on the front luminous ridge
          const crestBoost = r < 4 ? (4 - r) / 4 : 0;
          const alpha = Math.min(0.96, 0.1 + depthFade * 0.56 + crestBoost * 0.34);
          const radius = 0.7 + depthFade * 0.65 + crestBoost * 0.35;

          const red = Math.round(126 + crestBoost * 84);
          const green = Math.round(92 + crestBoost * 98);
          const blue = Math.round(244 + crestBoost * 11);

          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Soft luminous halo along the primary crest ridge (just like reference image)
      if (crestPoints.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(crestPoints[0].x, crestPoints[0].y);
        for (let i = 1; i < crestPoints.length; i += 1) {
          ctx.lineTo(crestPoints[i].x, crestPoints[i].y);
        }
        ctx.strokeStyle = 'rgba(182, 152, 255, 0.38)';
        ctx.lineWidth = 4.5;
        ctx.shadowColor = 'rgba(167, 139, 250, 0.9)';
        ctx.shadowBlur = 16;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(221, 214, 254, 0.42)';
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      if (isVisible) {
        drawFrame(now);
      }
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(loop);
      }
    };

    drawFrame(performance.now());
    if (!reducedMotion) {
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <section aria-label="Toolivo tagline showcase">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-[#140928] shadow-[0_14px_45px_-18px_rgba(91,33,182,0.55)]"
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
};

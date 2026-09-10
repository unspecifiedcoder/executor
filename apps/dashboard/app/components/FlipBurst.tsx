"use client";

import { useEffect, useRef } from "react";

export interface FlipEventDetail {
  fromRect: DOMRect;
  toRect: DOMRect;
  toEstate: boolean;
}

export const FLIP_EVENT = "executor:flip";

interface Particle {
  t: number; // 0..1 progress along the arc
  speed: number;
  size: number;
  arcOffset: number;
}

/**
 * The one full-screen moment in the app - fires only when FlowPanel detects
 * a REAL change in getPaymentDestination()'s result (see FlowPanel's
 * prevToEstate ref), never on mount and never as decoration. Mounted once at
 * the root so it can catch the event regardless of which page's FlowPanel
 * triggered it. A single fixed canvas spanning the viewport, normal state is
 * fully transparent and non-interactive.
 */
export default function FlipBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const flash = flashRef.current;
    if (!canvas || !flash) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;

    function onFlip(e: Event) {
      const { fromRect, toRect, toEstate } = (e as CustomEvent<FlipEventDetail>).detail;
      const color = toEstate
        ? getComputedStyle(document.documentElement).getPropertyValue("--administration").trim() || "#ffb545"
        : getComputedStyle(document.documentElement).getPropertyValue("--active").trim() || "#35f0c0";

      if (reduced) {
        // Still give a signal, just not a moving one.
        flash!.style.background = `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${color} 25%, transparent), transparent 70%)`;
        flash!.style.opacity = "1";
        setTimeout(() => (flash!.style.opacity = "0"), 400);
        return;
      }

      const from = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
      const to = { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 };
      // Arc control point - bow the path upward so particles don't just
      // slide in a flat line across the screen.
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 };

      const particles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
        t: -i * 0.01,
        speed: 0.0095 + Math.random() * 0.006,
        size: 2.5 + Math.random() * 3.5,
        arcOffset: (Math.random() - 0.5) * 55,
      }));

      const duration = 1500;
      const start = performance.now();
      document.documentElement.classList.add("flip-shake");
      setTimeout(() => document.documentElement.classList.remove("flip-shake"), 260);

      cancelAnimationFrame(raf);
      function frame(now: number) {
        const elapsed = now - start;
        const overallT = Math.min(1, elapsed / duration);
        ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // A brief full-viewport dim behind the burst so the glowing particles
        // actually pop against a busy real page instead of blending into it.
        const dimT = Math.min(1, elapsed / 200) - Math.max(0, (elapsed - 900) / 400);
        if (dimT > 0) {
          ctx!.fillStyle = `rgba(3, 4, 3, ${0.5 * Math.max(0, Math.min(1, dimT))})`;
          ctx!.fillRect(0, 0, window.innerWidth, window.innerHeight);
        }

        // Origin shockwave ring - expands and fades as particles depart.
        const ringT = Math.min(1, elapsed / 560);
        if (ringT < 1) {
          ctx!.save();
          ctx!.shadowColor = color;
          ctx!.shadowBlur = 24;
          ctx!.strokeStyle = color;
          ctx!.globalAlpha = (1 - ringT) * 0.95;
          ctx!.lineWidth = 3;
          ctx!.beginPath();
          ctx!.arc(from.x, from.y, 8 + ringT * 60, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.restore();
        }

        ctx!.save();
        ctx!.shadowColor = color;
        ctx!.shadowBlur = 14;
        for (const p of particles) {
          p.t += p.speed;
          if (p.t < 0 || p.t > 1) continue;
          const e = 1 - Math.pow(1 - p.t, 3); // ease-out cubic along the arc
          const x =
            (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * mid.x + e * e * to.x + p.arcOffset * Math.sin(e * Math.PI);
          const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * mid.y + e * e * to.y;
          const alpha = Math.sin(p.t * Math.PI);
          ctx!.globalAlpha = alpha;
          ctx!.fillStyle = color;
          ctx!.beginPath();
          ctx!.arc(x, y, p.size, 0, Math.PI * 2);
          ctx!.fill();
          // Bright core so particles don't just read as flat dots.
          ctx!.globalAlpha = alpha * 0.9;
          ctx!.fillStyle = "#ffffff";
          ctx!.beginPath();
          ctx!.arc(x, y, p.size * 0.35, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();

        // Trailing connector line along the arc, faint, gives the burst a
        // visible "stream" even where no particle currently sits.
        ctx!.save();
        ctx!.globalAlpha = 0.12;
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(from.x, from.y);
        ctx!.quadraticCurveTo(mid.x, mid.y, to.x, to.y);
        ctx!.stroke();
        ctx!.restore();

        // Arrival shockwave - starts once the first wave of particles lands.
        if (elapsed > 780) {
          const arriveT = Math.min(1, (elapsed - 780) / 630);
          ctx!.save();
          ctx!.shadowColor = color;
          ctx!.shadowBlur = 28;
          ctx!.strokeStyle = color;
          ctx!.globalAlpha = (1 - arriveT) * 1;
          ctx!.lineWidth = 3;
          ctx!.beginPath();
          ctx!.arc(to.x, to.y, 6 + arriveT * 80, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.restore();
        }

        if (overallT < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
      }
      raf = requestAnimationFrame(frame);

      flash!.style.background = `radial-gradient(circle at ${((to.x / window.innerWidth) * 100).toFixed(0)}% ${((to.y / window.innerHeight) * 100).toFixed(0)}%, color-mix(in srgb, ${color} 20%, transparent), transparent 60%)`;
      flash!.style.opacity = "1";
      setTimeout(() => {
        flash!.style.opacity = "0";
      }, 800);
    }

    window.addEventListener(FLIP_EVENT, onFlip);
    return () => {
      window.removeEventListener(FLIP_EVENT, onFlip);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="flip-burst-canvas" aria-hidden="true" />
      <div ref={flashRef} className="flip-burst-flash" aria-hidden="true" />

      <style>{`
        .flip-burst-canvas {
          position: fixed;
          inset: 0;
          z-index: 60;
          pointer-events: none;
        }
        .flip-burst-flash {
          position: fixed;
          inset: 0;
          z-index: 59;
          pointer-events: none;
          opacity: 0;
          transition: opacity 500ms var(--ease-settle);
        }
        @keyframes flip-shake {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, 2px); }
          80% { transform: translate(1px, -2px); }
          100% { transform: translate(0, 0); }
        }
        html.flip-shake {
          animation: flip-shake 260ms var(--ease-settle);
        }
        @media (prefers-reduced-motion: reduce) {
          html.flip-shake {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}

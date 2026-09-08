"use client";

import { useEffect } from "react";

/**
 * Cursor-reactive background: a faint grid + glow that drifts toward the
 * pointer. Writes directly to CSS custom properties instead of React state -
 * this needs to update on every mousemove, and re-rendering React for that
 * would be the wrong tool. Throttled to one write per animation frame.
 */
export default function AmbientField() {
  useEffect(() => {
    let raf = 0;
    let pending: { x: number; y: number } | null = null;

    function onMove(e: MouseEvent) {
      pending = { x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (pending) {
          document.documentElement.style.setProperty("--mx", `${pending.x}px`);
          document.documentElement.style.setProperty("--my", `${pending.y}px`);
        }
        raf = 0;
      });
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="ambient-grid" aria-hidden="true" />
      <div className="ambient-field" aria-hidden="true" />
    </>
  );
}

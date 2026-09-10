"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The agent's vital sign, drawn from its actual cadence.
 *
 * Every spike on this trace is a real `Heartbeat` event and the distance
 * between two spikes is the real number of seconds between them, indexed by the
 * subgraph. That matters more than it sounds: a decorative waveform on a page
 * about liveness would be the one piece of theatre that undermines everything
 * else on it. If the agent beat irregularly, this trace is irregular.
 *
 * The right-hand edge is now. The bar creeping across it is the time since the
 * last beat, measured against the deadline the registry will actually enforce -
 * so when an agent is dying, this fills up, and when it lapses, the contract
 * agrees.
 */
export default function LivenessMonitor({
  gaps,
  lastHeartbeat,
  deadlineSeconds,
  status,
}: {
  gaps: number[];
  lastHeartbeat: number | null;
  deadlineSeconds: number;
  status: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState<number | null>(null);

  // Client-only clock. Seeding from Date.now() during render makes the server
  // emit one elapsed time and the client hydrate with another, and React
  // answers that by discarding the server tree - the exact wrong trade for a
  // panel whose job is to look continuously live.
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const sinceLast = now === null || lastHeartbeat === null ? null : Math.max(0, now - lastHeartbeat);
  const fraction = sinceLast === null ? 0 : Math.min(1, sinceLast / deadlineSeconds);
  const alive = status === "active";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let phase = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const signal = alive ? "#35f0c0" : "#ffb545";
      const mid = h * 0.56;

      // graticule - an instrument reads as an instrument because of its grid
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      // Lay the real gaps out along the x axis, proportional to their duration.
      // Nothing here is generated: an even trace means the agent beat evenly.
      // Show the last dozen or so. Forty spikes across this width reads as
      // texture; the point of the trace is that a reader can see the rhythm and
      // spot a gap that is out of family.
      const recent = gaps.slice(-14);
      const series = recent.length ? recent : [deadlineSeconds / 3];
      const total = series.reduce((a, b) => a + b, 0) || 1;
      const usable = w * 0.86;

      ctx.beginPath();
      ctx.moveTo(0, mid);
      let x = 0;
      for (const gap of series) {
        const span = (gap / total) * usable;
        // baseline to just before the beat
        ctx.lineTo(x + span * 0.72, mid);
        // the beat itself: a QRS-ish spike, its height flat because a heartbeat
        // carries no magnitude - only the fact that it happened, and when
        ctx.lineTo(x + span * 0.78, mid - h * 0.3);
        ctx.lineTo(x + span * 0.84, mid + h * 0.16);
        ctx.lineTo(x + span * 0.9, mid);
        x += span;
      }
      ctx.lineTo(usable, mid);

      ctx.strokeStyle = signal;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = signal;
      ctx.shadowBlur = 10;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.shadowBlur = 0;

      // the live segment: from the last beat to now, and how close that is to
      // the deadline the contract enforces
      const liveStart = usable;
      const liveWidth = (w - usable) + usable * 0 + (w - usable);
      const endX = liveStart + Math.min(w - liveStart, (w - liveStart) * fraction);
      ctx.beginPath();
      ctx.moveTo(liveStart, mid);
      ctx.lineTo(endX, mid);
      ctx.strokeStyle = fraction > 0.75 ? "#ffb545" : signal;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      void liveWidth;

      // the sweep head, breathing so the panel is never a still image
      if (!reduced) phase += 0.05;
      const pulse = reduced ? 3 : 3 + Math.sin(phase) * 1.2;
      ctx.beginPath();
      ctx.arc(endX, mid, pulse, 0, Math.PI * 2);
      ctx.fillStyle = fraction > 0.75 ? "#ffb545" : signal;
      ctx.shadowColor = ctx.fillStyle as string;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [gaps, fraction, alive, deadlineSeconds]);

  return (
    <div className="monitor" data-alive={alive ? "yes" : "no"}>
      <div className="monitor-head">
        <span className="monitor-title">Liveness</span>
        <span className="monitor-readout mono">
          {sinceLast === null ? " " : `T+${sinceLast}s since beat`}
        </span>
      </div>
      <canvas ref={canvasRef} className="monitor-canvas" aria-hidden="true" />
      <div
        className="monitor-deadline"
        role="img"
        aria-label={`${sinceLast ?? 0} of ${deadlineSeconds} seconds to the administration deadline`}
      >
        <div
          className="monitor-deadline-fill"
          data-near={fraction > 0.75 ? "yes" : "no"}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      <div className="monitor-scale mono">
        <span>{gaps.length ? `${gaps.length} beats indexed` : "no beats indexed"}</span>
        <span className={fraction > 0.75 ? "monitor-warn" : undefined}>
          {sinceLast === null
            ? `deadline ${deadlineSeconds}s`
            : `${Math.max(0, deadlineSeconds - sinceLast)}s to administration`}
        </span>
      </div>
      <p className="monitor-note">
        Real cadence, indexed. Spike spacing is the measured gap between beats &mdash; not a
        generated waveform.
      </p>
    </div>
  );
}

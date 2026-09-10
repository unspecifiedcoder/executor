"use client";

import { useEffect, useRef, useState } from "react";
import { FLIP_EVENT, type FlipEventDetail } from "./FlipBurst";

interface FlowPanelProps {
  treasury: string;
  estate: string;
  destination: string;
  status: string;
  lastHeartbeat: number;
  eligibleAt: number;
  heartbeatInterval: number;
  gracePeriod: number;
  planLocked: boolean;
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relTime(seconds: number): string {
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

/**
 * The one shared visual for the product's actual thesis - a treasury/estate
 * flow diagram with a particle stream animated toward whichever box
 * getPaymentDestination() currently resolves to. Used on the overview hero,
 * /vitals, and any /agent/[agentId] page so the same real read drives the
 * same picture everywhere, not a bespoke diagram per page.
 */
export default function FlowPanel({
  treasury,
  estate,
  destination,
  status,
  lastHeartbeat,
  eligibleAt,
  heartbeatInterval,
  gracePeriod,
  planLocked,
}: FlowPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const treasuryBoxRef = useRef<HTMLDivElement>(null);
  const estateBoxRef = useRef<HTMLDivElement>(null);
  const prevToEstate = useRef<boolean | null>(null);
  // The wall clock is a client-only fact. Seeding this from Date.now() during
  // render makes the server emit one "Ns ago" and the client hydrate with
  // another, and React responds to that mismatch by throwing away the whole
  // server tree and re-rendering the root on the client - which is exactly the
  // wrong trade for a panel whose job is to look continuously live.
  const [now, setNow] = useState<number | null>(null);
  const toEstate = destination.toLowerCase() === estate.toLowerCase();
  const isActive = status === "active" || status === "resolved";
  const highlightColor = isActive ? "var(--active)" : "var(--administration)";

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Fire the full-screen burst only on a genuine change in the real
  // getPaymentDestination() result - never on first mount (that's just
  // reading whatever the chain already says), and never faked from a click.
  useEffect(() => {
    if (prevToEstate.current === null) {
      prevToEstate.current = toEstate;
      return;
    }
    if (prevToEstate.current === toEstate) return;
    prevToEstate.current = toEstate;

    const fromEl = toEstate ? treasuryBoxRef.current : estateBoxRef.current;
    const toEl = toEstate ? estateBoxRef.current : treasuryBoxRef.current;
    if (!fromEl || !toEl) return;

    window.dispatchEvent(
      new CustomEvent<FlipEventDetail>(FLIP_EVENT, {
        detail: { fromRect: fromEl.getBoundingClientRect(), toRect: toEl.getBoundingClientRect(), toEstate },
      }),
    );
  }, [toEstate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const dotCount = 5;
    const dir = toEstate ? 1 : -1;
    const positions = Array.from({ length: dotCount }, (_, i) => i / dotCount);
    let raf: number;
    let last = performance.now();

    function frame(t: number) {
      const dt = t - last;
      last = t;
      ctx!.clearRect(0, 0, width, height);

      ctx!.strokeStyle = "rgba(140,144,152,0.35)";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.moveTo(0, height / 2);
      ctx!.lineTo(width, height / 2);
      ctx!.stroke();

      const dotColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue(isActive ? "--active" : "--administration")
          .trim() || "#35f0c0";
      ctx!.fillStyle = dotColor;
      for (let i = 0; i < positions.length; i++) {
        if (!reduced) {
          positions[i] += (dir * dt) / 2600;
          positions[i] = ((positions[i] % 1) + 1) % 1;
        } else {
          positions[i] = i / dotCount;
        }
        const x = positions[i] * width;
        ctx!.globalAlpha = 0.35 + 0.65 * Math.sin(positions[i] * Math.PI);
        ctx!.beginPath();
        ctx!.arc(x, height / 2, 2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [toEstate, isActive]);

  const heartbeatAgo = now === null ? null : now - lastHeartbeat;
  const countdown = now === null ? null : eligibleAt - now;

  return (
    <div className="flow-panel">
      <div className="flow" style={{ ["--highlight" as string]: highlightColor }}>
        <div ref={treasuryBoxRef} className={`flow-box ${!toEstate ? "on" : ""}`}>
          <span className="flow-box-label">Treasury</span>
          <span className="flow-box-addr mono">{short(treasury)}</span>
          <span className="flow-box-tag">pays out while active</span>
        </div>

        <canvas ref={canvasRef} className="flow-canvas" aria-hidden="true" />

        <div ref={estateBoxRef} className={`flow-box ${toEstate ? "on" : ""}`}>
          <span className="flow-box-label">Estate</span>
          <span className="flow-box-addr mono">{short(estate)}</span>
          <span className="flow-box-tag">receives after grace period lapses</span>
        </div>
      </div>

      <div className="flow-ticker mono">
        <span>
          getPaymentDestination() → <strong>{toEstate ? "estate" : "treasury"}</strong> ({short(destination)})
        </span>
        <span>
          {heartbeatAgo === null || countdown === null
            ? "\u00a0"
            : isActive
              ? `last heartbeat ${relTime(heartbeatAgo)}`
              : countdown > 0
                ? `eligible for administration in ${countdown}s`
                : "eligible for administration now"}
        </span>
      </div>

      <div className="flow-chips">
        <div className="chip">
          <span className="chip-label">interval</span>
          <span className="chip-value mono">{duration(heartbeatInterval)}</span>
        </div>
        <div className="chip">
          <span className="chip-label">grace</span>
          <span className="chip-value mono">{duration(gracePeriod)}</span>
        </div>
        <div className="chip">
          <span className="chip-label">plan</span>
          <span className={`chip-value mono ${planLocked ? "locked" : ""}`}>
            {planLocked ? "locked ✓" : "unlocked"}
          </span>
        </div>
      </div>

      <style>{`
        .flow-panel {
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          padding: 24px;
          background: color-mix(in srgb, var(--raised) 60%, transparent);
        }
        .flow {
          display: grid;
          grid-template-columns: 1fr 64px 1fr;
          align-items: center;
          gap: 4px;
        }
        .flow-box {
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
          transition: border-color 300ms var(--ease-settle), box-shadow 300ms var(--ease-settle),
            background 300ms var(--ease-settle);
        }
        .flow-box-label {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--faint);
        }
        .flow-box-addr {
          font-size: 15px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .flow-box-tag {
          font-size: 10px;
          color: var(--faint);
          line-height: 1.4;
        }
        .flow-box.on {
          border-color: var(--highlight, var(--active));
          background: color-mix(in srgb, var(--highlight, var(--active)) 6%, transparent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--highlight, var(--active)) 40%, transparent);
        }
        .flow-box.on .flow-box-label {
          color: var(--highlight, var(--active));
        }
        .flow-canvas {
          width: 100%;
          height: 28px;
        }
        .flow-ticker {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
          font-size: 11px;
          color: var(--faint);
        }
        .flow-ticker strong {
          color: var(--text);
        }
        .flow-chips {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        .chip {
          flex: 1;
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .chip-label {
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--faint);
        }
        .chip-value {
          font-size: 13px;
          font-weight: 600;
        }
        .chip-value.locked {
          color: var(--active);
        }

        @media (max-width: 480px) {
          .flow {
            grid-template-columns: 1fr;
          }
          .flow-canvas {
            height: 24px;
          }
        }
      `}</style>
    </div>
  );
}

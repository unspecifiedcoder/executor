"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_ID } from "../../lib/ens";

// Derived from AGENT_ID rather than pasted, so repointing the dashboard at a
// different agent cannot leave a stale id on screen claiming to be the one
// being read.
const LINES = [
  "$ resolving executor-hackathon-demo.eth (ENSv2 · sepolia)",
  "$ connecting sepolia-rpc.publicnode.com",
  `$ reading ExecutorRegistry.plans(${AGENT_ID.slice(0, 10)}…)`,
  "$ getPaymentDestination() → resolving…",
];

const LAST_LINE_AT_MS = 180 + (LINES.length - 1) * 220;
// A fast RPC response (common on a good connection) could otherwise resolve
// getAgentPlan()/getPaymentDestination() before the lines even finish
// staggering in, making the whole sequence flash and vanish in one frame.
// Real latency still drives everything - this only ever adds a floor, never
// fakes a delay past what the real fetch already took.
const MIN_DISPLAY_MS = LAST_LINE_AT_MS + 500;

/**
 * Real fetch latency drives when this actually goes away - `done` doesn't
 * flip until getAgentPlan()/getPaymentDestination() have genuinely returned.
 * The lines describe those exact calls, not fictional flavor text, so
 * there's nothing here that isn't true the moment it appears on screen.
 */
export default function BootSequence({ done }: { done: boolean }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [hidden, setHidden] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const timers = LINES.map((_, i) => setTimeout(() => setVisibleLines((v) => Math.max(v, i + 1)), 180 + i * 220));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!done) return;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    const t = setTimeout(() => setHidden(true), remaining + 420);
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;

  return (
    <div className={`boot ${done ? "boot-done" : ""}`}>
      <div className="boot-lines mono">
        {LINES.slice(0, visibleLines).map((line, i) => (
          <div key={line} className="boot-line" style={{ ["--i" as string]: i }}>
            {line}
          </div>
        ))}
        {done && visibleLines >= LINES.length && (
          <div className="boot-line boot-ok" style={{ ["--i" as string]: LINES.length }}>
            {"> agent found — link established"}
          </div>
        )}
      </div>

      <style>{`
        .boot {
          position: absolute;
          inset: 0;
          z-index: 5;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 400ms var(--ease-settle);
        }
        .boot-done {
          opacity: 0;
          pointer-events: none;
        }
        .boot-lines {
          font-size: 12px;
          line-height: 1.9;
          color: var(--dim);
        }
        .boot-line {
          opacity: 0;
          animation: boot-in 260ms var(--ease-settle) forwards;
          animation-delay: calc(var(--i, 0) * 40ms);
        }
        .boot-ok {
          color: var(--active);
          margin-top: 4px;
        }
        @keyframes boot-in {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .boot-line {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

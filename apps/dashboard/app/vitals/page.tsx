"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getNameState } from "../../lib/ens";

const DEMO_LABEL = "executor-hackathon-demo";

type Phase = "active" | "confirm" | "unresponsive" | "administration";

const ACTIONS = [
  "Operations frozen",
  "Receiver role activated (ROLE_SET_RESOLVER)",
  "Revenue redirection pending — Estate not yet deployed",
];

export default function VitalsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("active");
  const [agentName, setAgentName] = useState<string>(DEMO_LABEL);
  const [lastBeatAgo, setLastBeatAgo] = useState(0.2);
  const [visibleActions, setVisibleActions] = useState(0);
  const stoppedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("active");
  phaseRef.current = phase;

  useEffect(() => {
    getNameState(DEMO_LABEL)
      .then((n) => setAgentName(`${n.label}.eth`))
      .catch(() => {});
  }, []);

  // heartbeat canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const samples: number[] = new Array(Math.floor(width)).fill(0);
    let t = 0;
    let raf: number;

    function draw() {
      t += 1;
      const alive = phaseRef.current === "active" || phaseRef.current === "confirm";
      let y: number;
      if (alive) {
        const beatPos = t % 90;
        if (beatPos === 0) y = -26;
        else if (beatPos === 4) y = 16;
        else if (beatPos === 7) y = -5;
        else y = (Math.random() - 0.5) * 2;
      } else {
        y = (Math.random() - 0.5) * 0.5;
      }
      samples.push(y);
      samples.shift();

      ctx!.clearRect(0, 0, width, height);
      ctx!.strokeStyle = alive ? "#34d399" : "#f0a93e";
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      const mid = height / 2;
      samples.forEach((s, i) => {
        const yy = mid + s;
        if (i === 0) ctx!.moveTo(i, yy);
        else ctx!.lineTo(i, yy);
      });
      ctx!.stroke();

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // last-beat-ago clock
  useEffect(() => {
    if (phase === "active" || phase === "confirm") {
      stoppedAtRef.current = null;
      const id = setInterval(() => setLastBeatAgo((v) => (v < 0.9 ? v + 0.1 : 0.1)), 100);
      return () => clearInterval(id);
    }
    if (stoppedAtRef.current === null) stoppedAtRef.current = Date.now();
    const id = setInterval(() => {
      setLastBeatAgo((Date.now() - (stoppedAtRef.current as number)) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  // auto-advance to administration, then reveal the action checklist
  useEffect(() => {
    if (phase !== "unresponsive") return;
    const id = setTimeout(() => setPhase("administration"), 2600);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "administration") return;
    setVisibleActions(0);
    ACTIONS.forEach((_, i) => {
      setTimeout(() => setVisibleActions((v) => Math.max(v, i + 1)), 500 + i * 450);
    });
  }, [phase]);

  const isDown = phase === "unresponsive" || phase === "administration";
  const statusLabel = phase === "administration" ? "administration" : isDown ? "unresponsive" : "active";
  const statusClass = phase === "administration" ? "administration" : isDown ? "administration" : "active";

  return (
    <main className="vitals">
      <Link href="/" className="back">
        ← EXECUTOR
      </Link>

      <div className="center">
        <div className="agent-name mono">{agentName}</div>

        <div className={`status big ${statusClass}`}>
          <span className="dot" />
          {statusLabel}
        </div>

        <canvas ref={canvasRef} className="waveform" />

        <div className="metric">
          <span className="metric-label">Last heartbeat</span>
          <span className="metric-value mono">
            {isDown ? `${lastBeatAgo.toFixed(1)}s ago` : `${lastBeatAgo.toFixed(1)}s ago`}
          </span>
        </div>

        <hr className="hr" />

        <div className="row">
          <span className="label">Live revenue</span>
          <span className="value">
            $12,481.23 <span className="tag sim">simulated</span>
          </span>
        </div>

        {phase === "administration" && (
          <div className="receivership">
            <hr className="hr" />
            <div className="receivership-header">
              <span className="status administration">
                <span className="dot" />
                receivership activated
              </span>
            </div>
            <ul className="actions">
              {ACTIONS.map((a, i) => (
                <li key={a} className={i < visibleActions ? "shown" : ""}>
                  <span className="check">{i < visibleActions ? "✓" : ""}</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="action-zone">
          {phase === "active" && (
            <button className="btn danger" onClick={() => setPhase("confirm")}>
              [ SIMULATE FAILURE ]
            </button>
          )}
          {phase === "confirm" && (
            <div className="confirm-row">
              <button className="btn" onClick={() => setPhase("active")}>
                [ CANCEL ]
              </button>
              <button className="btn danger" onClick={() => setPhase("unresponsive")}>
                [ STOP HEARTBEAT ]
              </button>
            </div>
          )}
          {isDown && (
            <button className="btn" onClick={() => setPhase("active")}>
              [ RESET DEMO ]
            </button>
          )}
        </div>
      </div>

      <style>{`
        .vitals {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 24px 64px;
        }
        .back {
          align-self: flex-start;
          font-family: var(--mono);
          font-size: 12px;
          letter-spacing: 0.08em;
          color: var(--faint);
        }
        .back:hover {
          color: var(--succession);
        }
        .center {
          width: 100%;
          max-width: 440px;
          margin-top: 56px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .agent-name {
          font-size: 14px;
          color: var(--dim);
          margin-bottom: 20px;
        }
        .status.big {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 32px;
        }
        .status.big .dot {
          width: 11px;
          height: 11px;
        }
        .waveform {
          width: 100%;
          height: 90px;
          margin-bottom: 24px;
        }
        .metric {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-bottom: 24px;
        }
        .metric-label {
          color: var(--dim);
          font-size: 13px;
        }
        .metric-value {
          font-size: 13px;
        }
        .vitals .hr {
          width: 100%;
        }
        .vitals .row {
          width: 100%;
        }
        .receivership {
          width: 100%;
          text-align: left;
        }
        .receivership-header {
          margin: 20px 0 12px;
        }
        .actions {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .actions li {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--faint);
          display: flex;
          gap: 10px;
          transition: color 0.2s ease;
        }
        .actions li.shown {
          color: var(--text);
        }
        .actions .check {
          width: 14px;
          color: var(--active);
        }
        .action-zone {
          margin-top: 40px;
        }
        .btn {
          background: transparent;
          border: 1px solid var(--border-strong);
          color: var(--text);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 10px 16px;
          border-radius: 4px;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .btn:hover {
          border-color: var(--succession);
          color: var(--succession);
        }
        .btn.danger:hover {
          border-color: var(--liquidation);
          color: var(--liquidation);
        }
        .confirm-row {
          display: flex;
          gap: 12px;
        }
      `}</style>
    </main>
  );
}

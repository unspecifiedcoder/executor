"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getNameState, getAgentPlan, type AgentPlan } from "../../lib/ens";

const DEMO_LABEL = "executor-hackathon-demo";

type Phase =
  | "loading"
  | "active"
  | "confirm"
  | "restoring"
  | "counting-down"
  | "flipping"
  | "administration"
  | "error";

const ACTIONS = [
  "Operations frozen",
  "Receiver role activated (ROLE_SET_RESOLVER)",
  "Revenue redirection pending — Estate not yet deployed",
];

function etherscanTx(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export default function VitalsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [agentName, setAgentName] = useState<string>(DEMO_LABEL);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [restoreTx, setRestoreTx] = useState<string | null>(null);
  const [adminTx, setAdminTx] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [visibleActions, setVisibleActions] = useState(0);
  const [flash, setFlash] = useState(false);
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;

  useEffect(() => {
    getNameState(DEMO_LABEL)
      .then((n) => setAgentName(`${n.label}.eth`))
      .catch(() => {});
  }, []);

  // Read real on-chain plan state on load - this is what decides the
  // starting phase, never a hardcoded default.
  useEffect(() => {
    getAgentPlan()
      .then((p) => {
        setPlan(p);
        setPhase(p.status === "administration" ? "administration" : "active");
        if (p.status === "administration") setVisibleActions(ACTIONS.length);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to read chain state");
        setPhase("error");
      });
  }, []);

  // heartbeat canvas - illustrative alive/flat indicator, not a literal feed
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

  // real countdown to the on-chain eligibleAt timestamp
  useEffect(() => {
    if (phase !== "counting-down" || !plan) return;
    let fired = false;
    const id = setInterval(() => {
      const left = plan.eligibleAt - Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        void flipToAdministration();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan]);

  useEffect(() => {
    if (phase !== "administration") return;
    setVisibleActions(0);
    ACTIONS.forEach((_, i) => {
      setTimeout(() => setVisibleActions((v) => Math.max(v, i + 1)), 500 + i * 450);
    });
  }, [phase]);

  async function stopHeartbeat() {
    setErrorMsg(null);
    setPhase("restoring");
    try {
      const res = await fetch("/api/actions/restore-active", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "restoreActive failed");

      if (data.alreadyInState) {
        // Someone else's request (another tab, a stale reload) already moved
        // this shared agent - resync to whatever's actually true on-chain
        // instead of erroring over a race that isn't really a failure.
        const freshPlan = await getAgentPlan();
        setPlan(freshPlan);
        setPhase(freshPlan.status === "administration" ? "administration" : "active");
        return;
      }

      setRestoreTx(data.txHash);
      const freshPlan = await getAgentPlan();
      setPlan(freshPlan);
      setSecondsLeft(Math.max(0, freshPlan.eligibleAt - Math.floor(Date.now() / 1000)));
      setPhase("counting-down");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "restoreActive failed");
      setPhase("error");
    }
  }

  async function flipToAdministration() {
    setPhase("flipping");
    try {
      const res = await fetch("/api/actions/enter-administration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "enterAdministration failed");

      if (data.alreadyInState) {
        const freshPlan = await getAgentPlan();
        setPlan(freshPlan);
        setPhase(freshPlan.status === "administration" ? "administration" : "active");
        return;
      }

      setAdminTx(data.txHash);
      setPhase("administration");
      // The real moment: this is the actual on-chain state transition, not a
      // simulated click - the one flash in the whole app, earned by a real tx.
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "enterAdministration failed");
      setPhase("error");
    }
  }

  function resetDemo() {
    setRestoreTx(null);
    setAdminTx(null);
    setErrorMsg(null);
    void stopHeartbeat(); // restoreActive() also serves as the reset action
  }

  const isDown = phase === "counting-down" || phase === "flipping" || phase === "administration";
  const statusLabel =
    phase === "administration"
      ? "administration"
      : phase === "flipping"
        ? "flipping..."
        : isDown
          ? "unresponsive"
          : phase === "loading"
            ? "reading chain..."
            : "active";
  const statusClass = phase === "administration" || phase === "flipping" ? "administration" : isDown ? "administration" : "active";

  return (
    <main className="vitals">
      {flash && <div className="flatline-flash" aria-hidden="true" />}

      <Link href="/" className="back pressable">
        ← EXECUTOR
      </Link>

      <div className="center">
        <div className="agent-name mono">{agentName}</div>

        <div key={statusLabel} className={`status big ${statusClass} status-crossfade`}>
          <span className="dot" />
          {statusLabel}
        </div>

        <canvas ref={canvasRef} className="waveform" />

        {phase === "counting-down" && (
          <div className="countdown mono">
            real heartbeat window lapses in <strong>{secondsLeft}s</strong>
          </div>
        )}

        {errorMsg && <div className="error-banner mono">{errorMsg}</div>}

        <div className="row">
          <span className="label">Live revenue</span>
          <span className="value">
            $12,481.23 <span className="tag sim">simulated</span>
          </span>
        </div>

        {restoreTx && (
          <div className="row">
            <span className="label">restoreActive() tx</span>
            <span className="value">
              <a href={etherscanTx(restoreTx)} target="_blank" rel="noreferrer">
                {restoreTx.slice(0, 10)}… ↗
              </a>{" "}
              <span className="tag live">live</span>
            </span>
          </div>
        )}
        {adminTx && (
          <div className="row">
            <span className="label">enterAdministration() tx</span>
            <span className="value">
              <a href={etherscanTx(adminTx)} target="_blank" rel="noreferrer">
                {adminTx.slice(0, 10)}… ↗
              </a>{" "}
              <span className="tag live">live</span>
            </span>
          </div>
        )}

        {phase === "administration" && (
          <div className="receivership receivership-in">
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
            <button className="btn danger pressable" onClick={() => setPhase("confirm")}>
              [ SIMULATE FAILURE ]
            </button>
          )}
          {phase === "confirm" && (
            <div className="confirm-row confirm-row-in">
              <button className="btn pressable" onClick={() => setPhase("active")}>
                [ CANCEL ]
              </button>
              <button className="btn danger pressable" onClick={stopHeartbeat}>
                [ STOP HEARTBEAT ]
              </button>
            </div>
          )}
          {phase === "restoring" && <div className="pending mono">submitting restoreActive()…</div>}
          {phase === "flipping" && <div className="pending mono">submitting enterAdministration()…</div>}
          {phase === "administration" && (
            <button className="btn pressable" onClick={resetDemo}>
              [ RESET DEMO ]
            </button>
          )}
          {phase === "error" && (
            <button className="btn pressable" onClick={resetDemo}>
              [ RETRY ]
            </button>
          )}
        </div>

        <p className="disclosure mono">
          This is a shared, live demo agent on Sepolia testnet. Clicking these buttons submits real
          transactions from a server-held operator key with worthless testnet funds - not a
          simulation.
        </p>
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
          margin-bottom: 16px;
        }
        .countdown {
          font-size: 12px;
          color: var(--dim);
          margin-bottom: 16px;
        }
        .countdown strong {
          color: var(--administration);
        }
        .error-banner {
          font-size: 12px;
          color: var(--liquidation);
          border: 1px solid var(--liquidation);
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 16px;
        }
        .pending {
          font-size: 12px;
          color: var(--dim);
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
          opacity: 0;
          transform: translateY(6px);
          transition: color 200ms var(--ease-settle), opacity 260ms var(--ease-settle),
            transform 260ms var(--ease-settle);
        }
        .actions li.shown {
          color: var(--text);
          opacity: 1;
          transform: translateY(0);
        }
        .actions .check {
          width: 14px;
          color: var(--active);
          display: inline-block;
          transform: scale(0);
          transition: transform 240ms var(--ease-pop);
        }
        .actions li.shown .check {
          transform: scale(1);
        }
        .action-zone {
          margin-top: 40px;
        }
        .disclosure {
          margin-top: 32px;
          font-size: 10px;
          line-height: 1.6;
          color: var(--faint);
          max-width: 360px;
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

        @keyframes status-in {
          from {
            opacity: 0;
            transform: translateY(-3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .status-crossfade {
          animation: status-in 220ms var(--ease-settle);
        }

        .confirm-row-in {
          animation: row-in 220ms var(--ease-settle);
        }
        .receivership-in {
          animation: row-in 320ms var(--ease-settle);
        }

        @keyframes flatline-pulse {
          0% {
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .flatline-flash {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background: radial-gradient(
            circle at 50% 40%,
            color-mix(in srgb, var(--administration) 22%, transparent),
            transparent 70%
          );
          animation: flatline-pulse 700ms linear;
        }
      `}</style>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getNameState, getAgentPlan, getPaymentDestination, type AgentPlan } from "../../lib/ens";
import FlowPanel from "../components/FlowPanel";

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
  const [destination, setDestination] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [restoreTx, setRestoreTx] = useState<string | null>(null);
  const [adminTx, setAdminTx] = useState<string | null>(null);
  const [toast, setToast] = useState<{ label: string; state: "pending" | "confirmed"; hash?: string } | null>(null);
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

  async function refreshPlan() {
    const [p, dest] = await Promise.all([getAgentPlan(), getPaymentDestination()]);
    setPlan(p);
    setDestination(dest);
    return p;
  }

  // Read real on-chain plan state on load - this is what decides the
  // starting phase, never a hardcoded default.
  useEffect(() => {
    refreshPlan()
      .then((p) => {
        setPhase(p.status === "administration" ? "administration" : "active");
        if (p.status === "administration") setVisibleActions(ACTIONS.length);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to read chain state");
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        y = 0;
      }
      samples.push(y);
      samples.shift();

      ctx!.clearRect(0, 0, width, height);
      ctx!.strokeStyle = alive ? "#9cff57" : "#ffbd59";
      ctx!.lineWidth = 1.5;
      ctx!.setLineDash(alive ? [] : [6, 6]);
      ctx!.beginPath();
      const mid = height / 2;
      samples.forEach((s, i) => {
        const yy = mid + s;
        if (i === 0) ctx!.moveTo(i, yy);
        else ctx!.lineTo(i, yy);
      });
      ctx!.stroke();
      ctx!.setLineDash([]);

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

  /**
   * The confirm button's real handler. restoreActive() can only ever succeed
   * when the on-chain status is already "administration" - calling it from
   * the agent's normal resting state (Active) always reverts server-side
   * with AlreadyInStateError and does nothing, which was a real dead-end:
   * clicking SIMULATE FAILURE on a freshly-registered or previously-reset
   * agent silently no-op'd. Instead, read the real plan and act on the real
   * eligibleAt directly - if the heartbeat is already stale enough to
   * qualify (a demo agent that's sat idle, as this one usually has), fire
   * enterAdministration() immediately; otherwise start a real countdown to
   * the real deadline. No restoreActive() call in this path at all.
   */
  async function armFailureSequence() {
    setErrorMsg(null);
    setPhase("restoring");
    try {
      const freshPlan = await refreshPlan();
      if (freshPlan.status !== "active") {
        setPhase(freshPlan.status === "administration" ? "administration" : "active");
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      if (now >= freshPlan.eligibleAt) {
        await flipToAdministration();
        return;
      }
      setSecondsLeft(freshPlan.eligibleAt - now);
      setPhase("counting-down");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to read chain state");
      setPhase("error");
    }
  }

  /** Only valid from Administration - flips back to Active with a fresh
   * lastHeartbeat, which is what makes the demo repeatable. Reused directly
   * by resetDemo(). */
  async function stopHeartbeat() {
    setErrorMsg(null);
    setPhase("restoring");
    setToast({ label: "restoreActive()", state: "pending" });
    try {
      const res = await fetch("/api/actions/restore-active", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "restoreActive failed");

      if (data.alreadyInState) {
        const freshPlan = await refreshPlan();
        setPhase(freshPlan.status === "administration" ? "administration" : "active");
        setToast(null);
        return;
      }

      setRestoreTx(data.txHash);
      setToast({ label: "restoreActive()", state: "confirmed", hash: data.txHash });
      await refreshPlan();
      setPhase("active");
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "restoreActive failed");
      setPhase("error");
      setToast(null);
    }
  }

  async function flipToAdministration() {
    setPhase("flipping");
    setToast({ label: "enterAdministration()", state: "pending" });
    try {
      const res = await fetch("/api/actions/enter-administration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "enterAdministration failed");

      if (data.alreadyInState) {
        const freshPlan = await refreshPlan();
        setPhase(freshPlan.status === "administration" ? "administration" : "active");
        setToast(null);
        return;
      }

      setAdminTx(data.txHash);
      setToast({ label: "enterAdministration()", state: "confirmed", hash: data.txHash });
      // Re-read the real destination after confirmation - the panel's flip
      // is a transition to real chain state, not a substitute for it.
      await refreshPlan();
      setPhase("administration");
      // The real moment: this is the actual on-chain state transition, not a
      // simulated click - the one flash in the whole app, earned by a real tx.
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "enterAdministration failed");
      setPhase("error");
      setToast(null);
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

      {toast && (
        <div className={`toast toast-${toast.state} mono`}>
          <span className="toast-dot" />
          <span>
            {toast.label} {toast.state === "pending" ? "submitted → pending…" : "confirmed"}
          </span>
          {toast.hash && (
            <a href={etherscanTx(toast.hash)} target="_blank" rel="noreferrer">
              ↗
            </a>
          )}
        </div>
      )}

      {phase === "administration" && (
        <div className="admin-banner mono">
          <strong>⚠ RECEIVERSHIP ACTIVATED</strong>
          <span>The agent went unresponsive. ExecutorRegistry now controls the payment route.</span>
        </div>
      )}

      <div className="layout">
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
                <button className="btn danger pressable" onClick={armFailureSequence}>
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

        <div className="side">
          {plan && destination ? (
            <FlowPanel
              treasury={plan.treasury}
              estate={plan.estate}
              destination={destination}
              status={plan.status}
              lastHeartbeat={plan.lastHeartbeat}
              eligibleAt={plan.eligibleAt}
              heartbeatInterval={plan.heartbeatInterval}
              gracePeriod={plan.gracePeriod}
              planLocked={plan.planLocked}
            />
          ) : (
            <div className="panel-loading mono">reading chain…</div>
          )}
        </div>
      </div>

      <style>{`
        .vitals {
          min-height: 100vh;
          padding: 32px 24px 64px;
        }
        .admin-banner {
          max-width: 900px;
          margin: 0 auto 24px;
          padding: 16px 20px;
          border: 1px solid color-mix(in srgb, var(--administration) 35%, transparent);
          background: color-mix(in srgb, var(--administration) 8%, transparent);
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          animation: row-in 400ms var(--ease-settle);
        }
        .admin-banner strong {
          color: var(--administration);
          font-size: 12px;
          letter-spacing: 0.04em;
        }
        .admin-banner span {
          color: var(--dim);
          font-size: 12px;
        }
        .layout {
          max-width: 900px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 48px;
          align-items: start;
        }
        .center {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .side {
          position: sticky;
          top: 80px;
        }
        .panel-loading {
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          color: var(--faint);
          font-size: 12px;
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
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
        }
        .vitals .row .label {
          color: var(--dim);
        }
        .vitals .row .value {
          font-family: var(--mono);
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

        .toast {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--raised);
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 12px;
          animation: row-in 220ms var(--ease-settle);
        }
        .toast a {
          color: var(--succession);
        }
        .toast-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--administration);
        }
        .toast-confirmed .toast-dot {
          background: var(--active);
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

        @media (max-width: 860px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .side {
            position: static;
            order: -1;
          }
        }
      `}</style>
    </main>
  );
}

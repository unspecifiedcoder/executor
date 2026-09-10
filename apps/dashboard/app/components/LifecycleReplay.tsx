"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FlowRack from "./FlowRack";
import WaterfallPour from "./WaterfallPour";
import { PROOF_STEPS, AGENT3, AGENT3_ID, REPLAY_SECONDS } from "../../lib/proof";

/**
 * Answers the judge question: "you claim the destination flipped - show me,
 * and show me it was the same payer both times."
 *
 * This replays a lifecycle that already happened on Sepolia. It is not a
 * simulation: each step names the transaction that performed it, and the two
 * payment steps are the two real USDC transfers from the same payer, 37 blocks
 * apart, that landed in different places. The control is deliberately labelled
 * "replay proof" rather than "demo" because a judge should be able to tell the
 * difference at a glance, and because the difference is the point.
 */
export default function LifecycleReplay({ agentId = AGENT3_ID }: { agentId?: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = PROOF_STEPS[index];
  const atEnd = index === PROOF_STEPS.length - 1;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    clear();
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setIndex((i) => i + 1), step.hold * 1000);
    return clear;
  }, [playing, index, atEnd, step.hold]);

  const restart = useCallback(() => {
    clear();
    setIndex(0);
    setPlaying(true);
  }, []);

  // Elapsed time up to the current step, so the scrubber is honest about pace.
  const elapsed = PROOF_STEPS.slice(0, index).reduce((a, s) => a + s.hold, 0);

  return (
    <section className="replay" aria-label="Replay of the agent 3 lifecycle on Sepolia">
      <header className="replay-head">
        <div>
          <h2 className="replay-title">Replay the Sepolia proof</h2>
          <p className="replay-sub">
            One agent, one life. Every step below is a transaction you can open.
          </p>
        </div>
        <div className="replay-controls">
          <button
            type="button"
            className="replay-btn replay-btn-primary"
            onClick={() => (atEnd ? restart() : setPlaying((p) => !p))}
          >
            {atEnd ? "Replay ↻" : playing ? "Pause ‖" : "Play ▶"}
          </button>
          <button
            type="button"
            className="replay-btn"
            onClick={() => {
              clear();
              setPlaying(false);
              setIndex((i) => Math.max(0, i - 1));
            }}
            disabled={index === 0}
          >
            ‹
          </button>
          <button
            type="button"
            className="replay-btn"
            onClick={() => {
              clear();
              setPlaying(false);
              setIndex((i) => Math.min(PROOF_STEPS.length - 1, i + 1));
            }}
            disabled={atEnd}
          >
            ›
          </button>
        </div>
      </header>

      {/* the state machine rail: the pip moves, it never cross-fades */}
      <ol className="phaserail" aria-label="Agent status">
        {(["active", "administration", "liquidation", "resolved"] as const).map((p) => {
          const on = step.phase === p;
          return (
            <li key={p} className={`phasenode ${on ? "phasenode-on" : ""}`} data-phase={p}>
              <span className="phasenode-dot" />
              <span className="phasenode-label">{p}</span>
            </li>
          );
        })}
      </ol>

      <div className="replay-body">
        <FlowRack
          phase={step.phase}
          destination={step.destination}
          treasury={AGENT3.treasury}
          estate={AGENT3.estate}
          entryLabel="Agent id"
          entryValue={`${AGENT3_ID.slice(0, 10)}…${AGENT3_ID.slice(-6)}`}
          resolverLabel="ExecutorRegistry"
          resolverValue="0x2946B46c…29e39"
          packet={
            step.packet ? { ...step.packet, id: `${index}-${step.packet.to}` } : null
          }
          compact
        />

        <aside className="replay-side">
          <div className="replay-step">
            <span className="replay-step-n mono">
              {String(index + 1).padStart(2, "0")}/{PROOF_STEPS.length}
            </span>
            <h3 className="replay-step-title">{step.title}</h3>
            <p className="replay-step-caption">{step.caption}</p>

            <dl className="replay-meta mono">
              <div>
                <dt>block</dt>
                <dd>{step.block.toLocaleString()}</dd>
              </div>
              <div>
                <dt>actor</dt>
                <dd data-actor={step.actor ?? "none"}>
                  {step.actor === "stranger" ? "stranger — holds no role" : (step.actor ?? "—")}
                </dd>
              </div>
            </dl>

            {step.tx ? (
              <a
                className="replay-tx mono"
                href={`https://sepolia.etherscan.io/tx/${step.tx}`}
                target="_blank"
                rel="noreferrer"
              >
                {step.tx.slice(0, 12)}…{step.tx.slice(-8)} ↗
              </a>
            ) : (
              <span className="replay-tx replay-tx-none mono">
                no transaction — this step is time passing
              </span>
            )}
          </div>

          {step.phase === "liquidation" && index >= 8 && <WaterfallPour />}
        </aside>
      </div>

      <div className="replay-scrub" role="presentation">
        <div
          className="replay-scrub-fill"
          style={{ width: `${Math.round((elapsed / REPLAY_SECONDS) * 100)}%` }}
        />
      </div>
      <p className="replay-foot mono">
        agent {agentId.slice(0, 10)}…{agentId.slice(-6)} · replayed from chain history, not simulated
      </p>
      <p className="replay-caveat mono">
        This lifecycle ran entirely on Sepolia, so it reads the registry directly. The ENS name
        resolves to the <em>live</em> agent above, not to this one — the two are demonstrated
        separately and no code joins them.
      </p>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FlowRack from "./FlowRack";
import WaterfallPour from "./WaterfallPour";
import BeatTrace from "./BeatTrace";
import LiveStrip from "./LiveStrip";
import { PROOF_STEPS, AGENT3, AGENT3_ID, REPLAY_SECONDS } from "../../lib/proof";
import type { IndexedClaim } from "../../lib/subgraph";

/**
 * The page's spine.
 *
 * Answers the judge question: "you say the destination flips — show me, and
 * show me it was the same payer both times."
 *
 * This replays a lifecycle that already happened on Sepolia. It is not a
 * simulation: each step names the transaction that performed it, and the two
 * payment steps are the two real USDC transfers from one payer, 37 blocks
 * apart, that landed in different places.
 *
 * One step index drives everything on screen — the vaults, the phase rail, the
 * heartbeat trace, the clock, the waterfall. That is deliberate: a judge should
 * never have to work out whether two panels are describing the same moment.
 */
export default function LifecycleReplay({
  claims,
  shortfall,
  live,
  agentId = AGENT3_ID,
}: {
  claims: IndexedClaim[];
  shortfall: number;
  live: {
    name: string;
    status: string;
    destination: string;
    lock: string;
    index: string;
    plan: string;
  };
  agentId?: string;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  const step = PROOF_STEPS[index];
  const atEnd = index === PROOF_STEPS.length - 1;

  // Deliberately does NOT autoplay. Overview is the manifesto and the hopper;
  // the lifecycle is something a judge asks for. Auto-scrubbing to step 03 on
  // first paint is what made the header lamp, the footer and the rail disagree
  // with each other before anyone had clicked anything.
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!playing || atEnd) {
      if (atEnd) setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setIndex((i) => i + 1), step.hold * 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, index, atEnd, step.hold]);

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIndex(0);
    setPlaying(true);
  }, []);

  const elapsed = PROOF_STEPS.slice(0, index).reduce((a, s) => a + s.hold, 0);
  const phase = step.phase;

  return (
    <>
      <section className="hero">
        <div>
          <h1>
            When an agent fails, its obligations <em>don&rsquo;t.</em>
          </h1>
          <p className="thesis">
            The destination of a payment is late-bound to the payee&rsquo;s on-chain liveness.
            Same client, same price, same command.
          </p>
          <div className="ctas">
            <button className="cta" onClick={atEnd ? restart : () => setPlaying((p) => !p)}>
              {atEnd ? "Replay the Sepolia proof ↻" : playing ? "Pause ‖" : "Replay the Sepolia proof ▶"}
            </button>
            {/* The protocol is permissionless, so the page should let a reader
                use it rather than only watch it. Same registry, their keys,
                their gas, no permission from us. */}
            <a className="cta cta-2" href="/register">
              Register your own agent →
            </a>
          </div>
        </div>

        <FlowRack
          phase={phase}
          destination={step.destination}
          treasury={AGENT3.treasury}
          estate={AGENT3.estate}
          entryLabel="getPaymentDestination(agentId)"
          entryValue={`${agentId.slice(0, 10)}…${agentId.slice(-6)}`}
          sealed={step.destination === "estate"}
          packet={step.packet ? { ...step.packet, id: `${index}-${step.packet.to}` } : null}
          treasuryFunded={index >= 3 && step.destination === "treasury"}
          estateFunded={index >= 6}
        />
      </section>

      <div className={`replaymark mono ${index > 0 || playing ? "on" : ""}`}>
        <span className="replaymark-dot" />
        REPLAY · agent 3 · historical · {phase}
      </div>

      <ol className="rail" aria-label="Agent status">
        <li className="pip" data-phase={phase} style={{ left: `${phaseIndex(phase) * 25}%` }} />
        {(["active", "administration", "liquidation", "resolved"] as const).map((p) => (
          <li key={p} className={phase === p ? "on" : undefined}>
            {p}
          </li>
        ))}
      </ol>

      <section className="step">
        <div className="idxcol">
          <div className="idx mono">
            {String(index + 1).padStart(2, "0")}/{PROOF_STEPS.length}
          </div>
          <div className="controls">
            <button
              className="on"
              onClick={atEnd ? restart : () => setPlaying((p) => !p)}
              aria-label="Play or pause the replay"
            >
              {atEnd ? "↻" : playing ? "‖" : "▶"}
            </button>
            <button onClick={() => { setPlaying(false); setIndex((i) => Math.max(0, i - 1)); }} disabled={index === 0} aria-label="Previous step">‹</button>
            <button onClick={() => { setPlaying(false); setIndex((i) => Math.min(PROOF_STEPS.length - 1, i + 1)); }} disabled={atEnd} aria-label="Next step">›</button>
          </div>
        </div>
        <div key={index} className="enter">
          <h2>{step.title}</h2>
          <p>{step.caption}</p>
          {step.tx ? (
            <a
              className="proof mono"
              href={`https://sepolia.etherscan.io/tx/${step.tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {step.tx.slice(0, 12)}…{step.tx.slice(-8)} ↗
            </a>
          ) : (
            <span className="proof mono none">no transaction — this step is time passing</span>
          )}
          {/* The stranger is the mechanism, not a flourish: enterAdministration
              is permissionless, so the address that seals the treasury holds no
              authority over this agent at all. */}
          {step.actor === "stranger" && (
            <div className="stranger mono">{AGENT3.stranger.slice(0, 10)}…{AGENT3.stranger.slice(-4)} — holds no role here</div>
          )}
        </div>
      </section>

      <section className="instr">
        <div className="cell">
          <div className="legend">Cadence — agent 3, indexed by The Graph</div>
          <BeatTrace state={step.dead ? "dead" : step.dying ? "dying" : "alive"} />
          <div className="readout mono">
            <div>
              <span>heartbeats</span>
              <b>{step.dead ? "18 stopped" : "18"}</b>
            </div>
            <div>
              <span>deadline</span>
              <b>420s</b>
            </div>
          </div>
        </div>
        <div className="cell">
          <div className="legend">Time until anyone may act</div>
          <div className={`clock mono ${step.gauge >= 100 ? "c" : step.gauge > 60 ? "b" : "a"}`}>
            {step.clock}
          </div>
          <div className="clocklbl mono">
            {step.gauge >= 100 ? "Window lapsed — anyone may act" : "Heartbeat window open"}
          </div>
          <div className="gauge">
            <i
              style={{
                width: `${step.gauge}%`,
                background:
                  step.gauge >= 100
                    ? "var(--terminal)"
                    : step.gauge > 60
                      ? "var(--lapsed)"
                      : "var(--alive)",
              }}
            />
          </div>
        </div>
      </section>

      <WaterfallPour
        claims={claims}
        shortfall={shortfall}
        available={200000}
        live={!!step.pour}
        unlocked={phase === "liquidation" || phase === "resolved"}
      />

      <div className="scrub" role="presentation">
        <div style={{ width: `${Math.round((elapsed / REPLAY_SECONDS) * 100)}%` }} />
      </div>

      <LiveStrip replaying={index > 0 || playing} phase={phase} live={live} />
    </>
  );
}

function phaseIndex(p: string): number {
  return ["active", "administration", "liquidation", "resolved"].indexOf(p);
}

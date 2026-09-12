"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FlowRack from "./FlowRack";
import StackProof from "./StackProof";
import WaterfallPour from "./WaterfallPour";
import BeatTrace from "./BeatTrace";
import LiveStrip from "./LiveStrip";
import { PROOF_STEPS, AGENT3, AGENT3_ID, REPLAY_SECONDS } from "../../lib/proof";
import type { IndexedClaim } from "../../lib/subgraph";

/** Hashes and addresses are shown truncated because the link carries the full
    value - the point on screen is that two of them differ, not what they are. */
const shortTx = (tx: string) => `${tx.slice(0, 10)}…${tx.slice(-6)}`;
const shortAddr = (a: string) => `${a.slice(0, 8)}…${a.slice(-4)}`;

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
        {/* One composition, not a headline competing with a panel. The subject
            of this page is a routing decision, so the routing decision is the
            first viewport and everything else is caption. */}
        {/* Problem, then solution, then proof - in that order. The page used to
            open on the thesis ("late-bound to on-chain liveness"), which is the
            mechanism, not the motive: a reader met two labelled boxes before
            being given any reason to care what was in them. */}
        <div className="heroline">
          <p className="eyebrow mono">Resolution protocol for autonomous agents</p>
          <h1>
            An agent dies. Its revenue <em>keeps arriving.</em>
          </h1>
          <p className="thesis">
            It lands in a treasury nobody operates, while the people it owed get nothing.
          </p>

          {/* The analogy does the explaining. Administration, liquidation and a
              trustee paying creditors in strict order are not metaphors we
              reached for - they are the states this contract implements, and
              naming their origin makes every label downstream self-evident. */}
          <dl className="analogy mono">
            <div className="an-row">
              <dt>When a company fails</dt>
              <dd>administration → liquidation → creditors paid in order</dd>
            </div>
            <div className="an-row an-gap">
              <dt>When an agent fails</dt>
              <dd className="none">nothing. the revenue just keeps arriving.</dd>
            </div>
          </dl>

          <p className="thesis close">
            Executor is that process, for software — a resolution plan the agent commits to{" "}
            <strong>while it is still alive</strong>, enforced on-chain, with no one&rsquo;s
            permission required.
          </p>
        </div>

        <p className="routeq mono">Where its revenue lands right now</p>

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

        {/* Proof in the first viewport, not below the fold: the rack above is
            our animation, and a reader has no reason to believe it until
            something they can check agrees with it. */}
        <StackProof indexLabel={live.index} />

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
          {/* Two receipts beat one assertion: where a step carries a `compare`,
              the earlier payment is rendered beside it so the "same payer, same
              amount, different destination" claim can be checked on the frame
              where it is made, rather than remembered from fifty seconds ago. */}
          {step.compare && step.tx ? (
            <div className="receipts mono">
              <a
                className="rrow past"
                href={`https://sepolia.etherscan.io/tx/${step.compare.tx}`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="h">{shortTx(step.compare.tx)}</span>
                <span className="ar">→</span>
                <span className="dst">{shortAddr(AGENT3[step.compare.to])}</span>
                <span className="lbl">{step.compare.to}</span>
                <span className="blk">#{step.compare.block}</span>
              </a>
              <a
                className="rrow now"
                href={`https://sepolia.etherscan.io/tx/${step.tx}`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="h">{shortTx(step.tx)}</span>
                <span className="ar">→</span>
                <span className="dst">{shortAddr(AGENT3[step.destination])}</span>
                <span className="lbl">{step.destination}</span>
                <span className="blk">#{step.block}</span>
              </a>
              <div className="same">
                same payer {shortAddr(AGENT3.payer)} · same 0.2 USDC ·{" "}
                {step.block - step.compare.block} blocks apart
              </div>
            </div>
          ) : step.tx ? (
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

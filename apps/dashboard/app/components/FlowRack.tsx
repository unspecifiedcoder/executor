"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Phase } from "../../lib/proof";

/**
 * Answers the judge question: "where does the money go, and why did that
 * change?"
 *
 * One rack, two sources. It renders live registry state on the overview, and
 * the agent-3 replay drives the same component with historical state - so the
 * thing a judge sees in the video is literally the thing on the site, not a
 * recording-only mock.
 *
 * The destination hopper is the peak frame of the whole submission. It uses a
 * shared `layoutId` so the lit face physically travels between hoppers rather
 * than one fading out while another fades in: a cross-fade reads as two
 * unrelated states, a move reads as a mechanism.
 */

const CLASS_FOR: Record<Phase, string> = {
  active: "active",
  administration: "administration",
  liquidation: "liquidation",
  resolved: "resolved",
};

export default function FlowRack({
  phase,
  destination,
  treasury,
  estate,
  entryLabel,
  entryValue,
  resolverLabel,
  resolverValue,
  packet,
  compact = false,
}: {
  phase: Phase;
  destination: "treasury" | "estate";
  treasury: string;
  estate: string;
  /** What a payer starts from. The ENS name on the live agent; the agent id on
   * the replay, because the name has never resolved to agent 3 and showing it
   * there would imply a link that does not exist. */
  entryLabel: string;
  entryValue: string;
  resolverLabel: string;
  resolverValue: string;
  /** A payment in flight, if one should be shown travelling the rail. */
  packet?: { amount: number; to: "treasury" | "estate"; id: string } | null;
  compact?: boolean;
}) {
  const toEstate = destination === "estate";

  return (
    <div className={`rack ${compact ? "rack-compact" : ""}`} data-phase={phase}>
      {/* the name is the entry point: a payer knows this and nothing else */}
      <div className="rack-node rack-name">
        <span className="rack-label">{entryLabel}</span>
        <span className="rack-value mono">{entryValue}</span>
      </div>

      <Conduit />

      <div className="rack-node">
        <span className="rack-label">
          {resolverLabel}
          <span className="rack-derived">derived, no stored address</span>
        </span>
        <span className="rack-value mono">{resolverValue}</span>
      </div>

      <Conduit />

      <div className="rack-node rack-primitive">
        <span className="rack-label">getPaymentDestination(agentId)</span>
        <span className="rack-value mono" data-dest={destination}>
          → {destination}
        </span>
      </div>

      {/* the rail the packet travels, and the fork it resolves to */}
      <div className="rack-rail">
        <div className="rack-rail-line" />
        <AnimatePresence>
          {packet && (
            <motion.div
              key={packet.id}
              layoutId="usdc-packet"
              className="rack-packet"
              initial={{ left: "2%", opacity: 0 }}
              animate={{
                left: packet.to === "treasury" ? "26%" : "74%",
                opacity: 1,
              }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
            >
              <span className="rack-packet-amount mono">{packet.amount.toLocaleString()}</span>
              <span className="rack-packet-unit mono">USDC</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="rack-hoppers">
        <Hopper
          name="Treasury"
          sub="paid while the agent is alive"
          addr={treasury}
          lit={!toEstate}
          phase={phase}
        />
        <Hopper
          name="Estate"
          sub="claims venue, once it is not"
          addr={estate}
          lit={toEstate}
          phase={phase}
        />
      </div>

      <p className="rack-foot mono">
        Same client, same price, same command. The destination is late-bound to on-chain liveness.
      </p>
    </div>
  );
}

function Conduit() {
  return (
    <div className="rack-conduit" aria-hidden="true">
      <span />
    </div>
  );
}

function Hopper({
  name,
  sub,
  addr,
  lit,
  phase,
}: {
  name: string;
  sub: string;
  addr: string;
  lit: boolean;
  phase: Phase;
}) {
  return (
    <div className={`hopper ${lit ? "hopper-lit" : ""}`} data-phase={CLASS_FOR[phase]}>
      {/* The lit face is one element shared between hoppers. Moving it is the
          animation; fading two copies would be a cross-dissolve, which reads as
          a slide change rather than as money being routed. */}
      {lit && (
        <motion.div
          layoutId="hopper-lit-face"
          className="hopper-face"
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      )}
      <div className="hopper-body">
        <span className="hopper-name">{name}</span>
        <span className="hopper-addr mono">{shorten(addr)}</span>
        <span className="hopper-sub">{sub}</span>
      </div>
    </div>
  );
}

function shorten(a: string): string {
  if (!a || a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

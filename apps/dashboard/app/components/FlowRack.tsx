"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Phase } from "../../lib/proof";

/**
 * Answers the judge question: "where does the money go, and why did that
 * change?"
 *
 * This is the peak frame of the whole submission, so it gets the only two
 * borders on the page. Everything else is a plane divided by hairlines — the
 * treasury and the estate are the only objects in the composition, which is why
 * the eye lands on them.
 *
 * The packet always launches aimed at the treasury, because the payer never
 * knows: `route-payment.sh` takes an agent id and no destination. When the
 * treasury is sealed the packet reaches it, recoils, and the protocol sends it
 * across to the estate. That deflection is the argument — a cross-fade between
 * two highlighted boxes would read as a slide change rather than as money being
 * redirected by a rule.
 */
export default function FlowRack({
  phase,
  destination,
  treasury,
  estate,
  entryLabel,
  entryValue,
  sealed,
  packet,
  treasuryFunded,
  estateFunded,
}: {
  phase: Phase;
  destination: "treasury" | "estate";
  treasury: string;
  estate: string;
  entryLabel: string;
  entryValue: string;
  /** The treasury is no longer the destination — drawn as physically shut. */
  sealed: boolean;
  packet?: { amount: number; to: "treasury" | "estate"; id: string } | null;
  treasuryFunded: boolean;
  estateFunded: boolean;
}) {
  const toEstate = destination === "estate";

  return (
    <div className="rack" data-phase={phase}>
      <div className="q mono">{entryLabel}</div>
      <p className={`answer mono ${toEstate ? "e" : "t"}`}>
        → <b>{toEstate ? "estate" : "treasury"}</b>
      </p>
      <div className="agentid mono">{entryValue}</div>

      <div className="stage">
        <AnimatePresence>
          {packet && (
            <motion.div
              key={packet.id}
              className="packet mono"
              initial={{ left: "7%", top: 0, opacity: 0, scale: 0.72, rotate: 0 }}
              animate={
                packet.to === "treasury"
                  ? { left: "26%", top: [0, 0, 34], opacity: [0, 1, 1, 0], scale: 1, rotate: 0 }
                  : {
                      // out to the treasury, recoil off the seal, then across
                      left: ["7%", "26%", "26%", "74%", "74%"],
                      top: [0, 0, -7, 0, 34],
                      rotate: [0, 0, -11, 5, 0],
                      opacity: [0, 1, 1, 1, 0],
                      scale: 1,
                    }
              }
              exit={{ opacity: 0 }}
              transition={{
                duration: packet.to === "treasury" ? 1.9 : 3.2,
                times:
                  packet.to === "treasury" ? [0, 0.18, 0.75, 1] : [0, 0.36, 0.46, 0.8, 1],
                ease: "easeInOut",
              }}
            >
              {packet.amount.toLocaleString()}
              <s>USDC</s>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="vaults">
          <Vault
            name="Treasury"
            addr={treasury}
            lit={!toEstate}
            sealed={sealed}
            funded={treasuryFunded}
            state={sealed ? "Sealed — no longer the destination" : "Receiving"}
          />
          <Vault
            name="Estate"
            addr={estate}
            lit={toEstate}
            sealed={false}
            funded={estateFunded}
            state={toEstate ? "Receiving" : "Closed"}
          />
        </div>
      </div>
    </div>
  );
}

function Vault({
  name,
  addr,
  lit,
  sealed,
  funded,
  state,
}: {
  name: string;
  addr: string;
  lit: boolean;
  sealed: boolean;
  funded: boolean;
  state: string;
}) {
  return (
    <motion.div
      className={`vault ${lit ? "on" : ""} ${sealed ? "shut" : ""} ${name === "Treasury" ? "t" : "e"}`}
      animate={funded ? { y: [0, 8, -2, 0] } : { y: 0 }}
      transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
    >
      <h3>{name}</h3>
      <div className="addr mono">
        {addr.slice(0, 6)}…{addr.slice(-4)}
      </div>
      <span className="state mono">{state}</span>
      <div className={`bal mono ${funded ? "on" : ""}`}>+200,000 USDC</div>
    </motion.div>
  );
}

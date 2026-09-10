"use client";

import { motion } from "framer-motion";
import type { IndexedClaim } from "../../lib/subgraph";

/**
 * Answers the judge question: "when there isn't enough money, who actually
 * gets paid?"
 *
 * Renders the distribution `executePlan` really performed, read from the index
 * rather than written into the page. A waterfall demo where everyone is made
 * whole is not demonstrating priority — it is demonstrating a transfer — so the
 * shortfall is stated rather than hidden, and the classes that got nothing are
 * drawn as empty rather than omitted.
 *
 * Bars fill in priority order so the ordering reads as a sequence, not as three
 * unrelated numbers.
 */
export default function WaterfallPour({
  claims,
  shortfall,
  available,
  live,
  unlocked,
}: {
  claims: IndexedClaim[];
  shortfall: number;
  available: number;
  /** True once executePlan has run — the bars fill. */
  live: boolean;
  /** True once the agent is in liquidation. Before that the book is not just
   *  empty, it is *not yet openable*, and saying so is the point: creditors
   *  cannot be paid while the agent might still recover. Showing an insolvency
   *  book beside a living agent undoes the story the rest of the page tells. */
  unlocked: boolean;
}) {
  const owed = claims.reduce((a, c) => a + c.allowed, 0);

  if (!unlocked) {
    return (
      <section className="fall locked" aria-label="Creditor waterfall">
        <header className="fallhead">
          <span>Creditor waterfall</span>
          <span className="lockmsg">Unlocks at liquidation</span>
        </header>
        <p className="lockcopy">
          {claims.length} claims are registered and the trustee has committed to the set. Nothing
          can be paid out while the agent might still recover — only a trustee-declared liquidation
          opens this book.
        </p>
        <div className="lockbars" aria-hidden="true">
          {claims.map((c) => (
            <div key={c.creditor} className="lockbar">
              <span className="mono">{c.priorityClass.toUpperCase()}</span>
              <div className="tank" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="fall" aria-label="Creditor waterfall">
      <header className="fallhead">
        <span>Creditor waterfall</span>
        <span>
          {available.toLocaleString()} available · {owed.toLocaleString()} owed · shortfall{" "}
          {shortfall.toLocaleString()}
        </span>
      </header>

      {claims.map((c, i) => {
        const pct = c.allowed === 0 ? 0 : Math.round((c.paid / c.allowed) * 100);
        return (
          <div
            key={c.creditor}
            className={`claim ${live ? "on" : ""} ${c.paid === 0 ? "dry" : ""}`}
          >
            <div className="claimhead">
              <b>{c.priorityClass.toUpperCase()}</b>
              <s className="mono">
                {c.creditor.slice(0, 10)}…{c.creditor.slice(-4)}
              </s>
            </div>
            <div className="tank">
              <motion.i
                initial={{ width: 0 }}
                animate={{ width: live ? `${pct}%` : 0 }}
                transition={{ duration: 1.05, delay: live ? 0.2 + i * 0.45 : 0, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="claimfoot mono">
              <span>
                {c.paid.toLocaleString()} / {c.allowed.toLocaleString()}
              </span>
              <span className={c.paid === 0 ? "none" : undefined}>
                {!live ? "—" : c.paid === 0 ? "nothing" : "paid to the limit of funds"}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

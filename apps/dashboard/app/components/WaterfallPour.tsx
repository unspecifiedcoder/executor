"use client";

import { motion } from "framer-motion";
import { AGENT3_CLAIMS, AGENT3_TOTALS } from "../../lib/proof";

/**
 * Answers the judge question: "when there isn't enough money, who actually
 * gets paid?"
 *
 * Renders the distribution `executePlan` really performed: 200,000 available
 * against 850,000 owed. Secured fills, the other two classes stay dry, and the
 * shortfall is stated rather than hidden - a waterfall demo where everyone gets
 * paid is not demonstrating priority at all, it is demonstrating a transfer.
 *
 * Bars fill in class order so the ordering is legible as sequence, not just as
 * three static numbers.
 */
export default function WaterfallPour() {
  return (
    <div className="pour">
      <div className="pour-head">
        <span className="pour-title">Waterfall</span>
        <span className="pour-ratio mono">
          {AGENT3_TOTALS.available.toLocaleString()} available ·{" "}
          {AGENT3_TOTALS.owed.toLocaleString()} owed
        </span>
      </div>

      <ul className="pour-shelves">
        {AGENT3_CLAIMS.map((c, i) => {
          const pct = c.allowed === 0 ? 0 : Math.round((c.paid / c.allowed) * 100);
          return (
            <li key={c.creditor} className="shelf" data-dry={c.paid === 0 ? "yes" : "no"}>
              <div className="shelf-head">
                <span className="shelf-class">{c.klass}</span>
                <span className="shelf-creditor mono">{c.creditor}</span>
              </div>
              <div className="shelf-track">
                <motion.div
                  className="shelf-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, delay: 0.25 + i * 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="shelf-nums mono">
                <span>
                  {c.paid.toLocaleString()} / {c.allowed.toLocaleString()}
                </span>
                <span className={c.paid === 0 ? "shelf-zero" : "shelf-paid"}>
                  {c.paid === 0 ? "nothing" : "paid in full to the limit of funds"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="pour-foot mono">
        shortfall {AGENT3_TOTALS.shortfall.toLocaleString()} · strict priority, not pro-rata across
        classes
      </p>
    </div>
  );
}

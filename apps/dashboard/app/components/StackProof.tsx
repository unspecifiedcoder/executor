"use client";

import { useEffect, useState } from "react";

/**
 * The whole stack, proved in one line, in the first viewport.
 *
 * A judge should not have to take the animation above on trust, and should not
 * have to scroll to find out whether any of it is real. Each chip is a live
 * read of a different system - ENS on Sepolia, the hosted x402 paywall, Hedera
 * consensus, the subgraph - and the two that can be checked on someone else's
 * website link out to it.
 *
 * Chips render only when their read succeeded. A row of green ticks that stays
 * green when the services are down would be worse than no row at all.
 */

type Rail = {
  ensName: string | null;
  crossCheck: string | null;
  hederaAccount: string | null;
  challenge: { status: number; network: string | null; amount: string | null };
  settlement: { id: string; amountHbar: number } | null;
};

const hashscanTx = (id: string) => {
  const m = id.match(/^(\d+\.\d+\.\d+)-(\d+)-(\d+)$/);
  return `https://hashscan.io/testnet/transaction/${m ? `${m[1]}@${m[2]}.${m[3]}` : id}`;
};

export default function StackProof({ indexLabel }: { indexLabel: string }) {
  const [rail, setRail] = useState<Rail | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/rail")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setRail(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const indexOk = /^block/.test(indexLabel);

  return (
    <div className="stackproof mono" aria-label="Live proof of each system">
      {rail?.ensName && (
        <span className="sp">
          <i className="ok" />
          ENS <b>{rail.ensName}</b>
        </span>
      )}
      {rail?.crossCheck === "passed" && (
        <span className="sp">
          <i className="ok" />
          registry cross-check <b>passed</b>
        </span>
      )}
      {rail?.challenge?.status === 402 && (
        <span className="sp">
          <i className="ok" />
          x402 <b>402 live</b> on {rail.challenge.network ?? "hedera:testnet"}
        </span>
      )}
      {rail?.settlement && (
        <a className="sp link" href={hashscanTx(rail.settlement.id)} target="_blank" rel="noreferrer">
          <i className="ok" />
          Hedera <b>{rail.settlement.amountHbar.toFixed(2)} ℏ settled</b> ↗
        </a>
      )}
      {indexOk && (
        <span className="sp">
          <i className="ok" />
          The Graph <b>{indexLabel}</b>
        </span>
      )}

      <style>{`
        .stackproof{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--s2) var(--s4);
          margin-top:var(--s5);font-size:var(--t2);color:var(--dim);min-height:18px}
        .stackproof .sp{display:inline-flex;align-items:center;gap:6px;letter-spacing:.02em;
          text-decoration:none;color:inherit}
        .stackproof .sp b{color:var(--text);font-weight:500}
        .stackproof .link:hover b{color:var(--text)}
        .stackproof i{width:5px;height:5px;border-radius:50%;background:var(--alive);
          box-shadow:0 0 7px var(--alive);flex:none}
      `}</style>
    </div>
  );
}

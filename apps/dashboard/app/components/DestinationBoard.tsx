"use client";

import { useEffect, useState } from "react";

/**
 * A departure board for money.
 *
 * The replay upstairs is an animation - our drawing of the flip. This is the
 * flip itself, read live from three systems this project does not own: the
 * hosted gateway resolving through ENS, a real x402 challenge served over HTTP,
 * and Hedera's public mirror node.
 *
 * The word is the hero and the account number is evidence, which is the
 * opposite of the obvious layout. Two Hedera accounts that differ only in their
 * final digit are indistinguishable at a glance, so sizing the number as the
 * headline would make both states look identical to anyone not reading closely
 * - the exact people this panel exists for. TREASURY and ESTATE share no
 * letters and cannot be confused.
 */

type Rail = {
  ensName: string | null;
  resolver: string | null;
  payTo: string | null;
  registry: string | null;
  crossCheck: string | null;
  hederaAccount: string | null;
  venue: "treasury" | "estate" | null;
  status: string | null;
  lastHeartbeat: number | null;
  eligibleAt: number | null;
  challenge: {
    status: number;
    network: string | null;
    asset: string | null;
    amount: string | null;
    payTo: string | null;
    agrees: boolean;
  };
  settlement: { id: string; amountHbar: number; consensusAt: number } | null;
  error?: string;
};

const short = (a: string | null, head = 8, tail = 5) =>
  a ? `${a.slice(0, head)}…${a.slice(-tail)}` : "—";

/** HashScan wants the canonical `0.0.X@SECONDS.NANOS` form; the mirror node
 *  hands back the hyphenated one. */
const hashscanTx = (id: string) => {
  const m = id.match(/^(\d+\.\d+\.\d+)-(\d+)-(\d+)$/);
  return `https://hashscan.io/testnet/transaction/${m ? `${m[1]}@${m[2]}.${m[3]}` : id}`;
};

function clock(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DestinationBoard() {
  const [rail, setRail] = useState<Rail | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/rail")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: Rail) => alive && (setRail(d), setFailed(false)))
        .catch(() => alive && setFailed(true));
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Ticks locally so the countdown moves every second rather than lurching
  // once per poll. The number it counts toward still comes from the chain.
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (failed) {
    return (
      <section className="board board-flat mono">
        <span>The payment rail could not be read.</span>
        <span className="flat-sub">
          This panel shows live third-party state — it has no cached fallback, so it says nothing
          rather than something stale.
        </span>
      </section>
    );
  }

  if (!rail) {
    return <section className="board board-flat mono">reading the rail…</section>;
  }

  const venue = rail.venue ?? "treasury";
  const lapsed = venue === "estate" || rail.status !== "active";
  const remaining = rail.eligibleAt ? rail.eligibleAt - now : null;
  const beatAge = rail.lastHeartbeat ? now - rail.lastHeartbeat : null;

  return (
    <section className={`board ${lapsed ? "is-lapsed" : "is-alive"}`} aria-live="polite">
      <header className="b-top mono">
        <span className="b-q">Your payment lands in</span>
        <span className="b-beat">
          <span className="b-led" />
          {lapsed ? "lapsed" : "alive"}
          {beatAge !== null && !lapsed && <span className="b-age"> · beat {beatAge}s ago</span>}
        </span>
      </header>

      <div className="b-hero">
        <div className="b-word">{venue === "estate" ? "ESTATE" : "TREASURY"}</div>
        <div className="b-acct mono">
          Hedera <b>{rail.hederaAccount ?? "—"}</b>
        </div>
        <div className="b-sub mono">{short(rail.payTo)} · native HBAR</div>
      </div>

      {remaining !== null && (
        <div className="b-clock mono">
          <span className="b-clabel">
            {lapsed ? "resolution window open" : "resolution window opens in"}
          </span>
          <span className="b-ctime">{clock(remaining)}</span>
          <span className="b-cnote">the contract checks the deadline, not the caller</span>
        </div>
      )}

      <div className="b-chain mono">
        <span className="b-ens">{rail.ensName ?? "—"}</span>
        <span className="b-sep">→</span>
        <span>resolver</span>
        <span className="b-sep">→</span>
        <span>registry</span>
        {rail.crossCheck === "passed" && <span className="b-ok">cross-check ✓</span>}
        <span className="b-sep">→</span>
        <span>mirror node</span>
      </div>

      <div className="b-rows">
        <div className="b-r">
          <div className="b-rk mono">the live 402 quotes</div>
          <div className="b-rv mono">
            {rail.challenge.payTo ?? "—"}
            {rail.challenge.agrees && <span className="b-match">✓ same</span>}
            {rail.challenge.amount && (
              <span className="b-sm">
                {Number(rail.challenge.amount).toLocaleString()} tinybars
              </span>
            )}
          </div>
        </div>
        <div className="b-r">
          <div className="b-rk mono">last payment that landed</div>
          <div className="b-rv mono">
            {rail.settlement ? (
              <>
                <span className="b-amt">{rail.settlement.amountHbar.toFixed(2)} ℏ</span>
                <span className="b-sm">
                  {new Date(rail.settlement.consensusAt).toISOString().slice(11, 16)} UTC
                </span>
                <a
                  className="b-ext"
                  href={hashscanTx(rail.settlement.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  HashScan ↗
                </a>
              </>
            ) : (
              <span className="b-sm">nothing has landed here yet</span>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .board{border:1px solid var(--border-strong);border-radius:10px;background:var(--raised);
          overflow:hidden;max-width:820px;margin:56px auto 0}
        .board.is-lapsed{border-color:color-mix(in srgb,var(--administration) 36%,transparent)}
        .board-flat{padding:20px;color:var(--dim);font-size:12px;display:flex;
          flex-direction:column;gap:6px;text-align:center}
        .flat-sub{color:var(--faint);font-size:11px;line-height:1.6}

        .b-top{display:flex;align-items:center;gap:10px;padding:9px 16px;
          border-bottom:1px solid var(--border);
          background:linear-gradient(180deg,rgba(150,190,235,.05),transparent)}
        .b-q{font-size:10.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--dim)}
        .b-beat{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-size:10px;
          letter-spacing:.14em;text-transform:uppercase;color:var(--active)}
        .is-lapsed .b-beat{color:var(--administration)}
        .b-age{color:var(--faint);letter-spacing:.04em}
        .b-led{width:7px;height:7px;border-radius:50%;background:currentColor;
          box-shadow:0 0 10px currentColor;animation:b-pulse 2.6s ease-in-out infinite}
        .is-lapsed .b-led{animation-duration:.85s}
        @keyframes b-pulse{0%,100%{opacity:1}50%{opacity:.25}}

        .b-hero{padding:30px 16px 22px;text-align:center;
          background:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 3px),
            color-mix(in srgb,var(--bg) 65%,black)}
        .b-word{font-weight:800;letter-spacing:-.015em;line-height:.92;
          font-size:clamp(46px,8vw,80px);color:var(--active);
          text-shadow:0 0 34px color-mix(in srgb,var(--active) 28%,transparent)}
        .is-lapsed .b-word{color:var(--administration);
          text-shadow:0 0 34px color-mix(in srgb,var(--administration) 28%,transparent)}
        .b-acct{margin-top:14px;font-size:13px;color:var(--dim)}
        .b-acct b{color:var(--text);font-weight:600}
        .b-sub{margin-top:5px;font-size:10.5px;color:var(--faint)}

        .b-clock{display:flex;align-items:center;justify-content:center;gap:12px;padding:11px 16px;
          border-top:1px solid var(--border);border-bottom:1px solid var(--border);
          background:rgba(0,0,0,.2)}
        .b-cnote{font-size:9.5px;color:var(--faint);letter-spacing:.02em}
        .b-clabel{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}
        .b-ctime{font-size:23px;font-weight:600;letter-spacing:.06em;color:var(--active);
          font-variant-numeric:tabular-nums}
        .is-lapsed .b-ctime{color:var(--administration)}

        .b-chain{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px;
          padding:10px 16px;border-bottom:1px solid var(--border);font-size:10px;color:var(--faint)}
        .b-ens{color:var(--succession)}
        .b-sep{opacity:.45}
        .b-ok{color:var(--active);border:1px solid currentColor;border-radius:3px;padding:0 5px;
          font-size:9px;letter-spacing:.08em}

        .b-rows{display:grid;grid-template-columns:1fr 1fr}
        .b-r{padding:12px 16px;border-right:1px solid var(--border)}
        .b-r:last-child{border-right:0}
        .b-rk{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);
          margin-bottom:5px}
        .b-rv{font-size:12px;color:var(--text);display:flex;align-items:baseline;flex-wrap:wrap;
          gap:6px}
        .b-sm{color:var(--dim);font-size:10px}
        .b-amt{color:var(--active);font-weight:600}
        .is-lapsed .b-amt{color:var(--administration)}
        .b-match{color:var(--active);font-size:9.5px;letter-spacing:.08em}
        .b-ext{color:var(--succession);text-decoration:none;font-size:10px;
          border:1px solid var(--border-strong);border-radius:4px;padding:2px 7px}
        .b-ext:hover{background:color-mix(in srgb,var(--succession) 9%,transparent)}

        @media (max-width:620px){
          .b-rows{grid-template-columns:1fr}
          .b-r{border-right:0;border-bottom:1px solid var(--border)}
          .b-r:last-child{border-bottom:0}
        }
        @media (prefers-reduced-motion:reduce){ .b-led{animation:none} }
      `}</style>
    </section>
  );
}

import Link from "next/link";
import { getNameState, hasRole, ROLE_SET_RESOLVER_ADMIN, getAgentStatus, EXECUTOR_REGISTRY } from "../lib/ens";

const DEMO_LABEL = "executor-hackathon-demo";
const OPERATOR = "0x72db032c0dfb6e7502e16a73fabdab31712dc706" as const;

// Most recent real enterAdministration() tx from this demo agent's actual
// on-chain history - a fast, click-to-verify proof point for a skimming judge.
const LAST_KNOWN_TX = "0x5e120ca72909c3e02aa1377e7bd4bd329a068124626d42c668b89a8d6d84a251";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const revalidate = 30;

export default async function OverviewPage() {
  const [name, status] = await Promise.all([
    getNameState(DEMO_LABEL).catch(() => null),
    getAgentStatus().catch(() => null),
  ]);
  const locked = name ? !(await hasRole(name.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR)) : null;
  const statusClass = status ?? "active";

  return (
    <main className="overview">
      <header className="hero">
        <div className="wordmark">EXECUTOR</div>

        <div className={`hero-status ${statusClass}`}>
          <span className="hero-status-dot" />
          <span className="hero-status-label">{status ?? "reading chain…"}</span>
        </div>

        <h1>
          When an agent fails,
          <br />
          its obligations don&rsquo;t.
        </h1>
        <div className="cta-row">
          <Link href="/vitals" className="cta pressable">
            VIEW LIVE AGENT →
          </Link>
          <Link href="/register" className="cta ghost pressable">
            REGISTER YOUR OWN AGENT
          </Link>
        </div>

        <div className="proof-strip mono">
          <span className="proof-label">verified onchain</span>
          <a
            href={`https://sepolia.etherscan.io/address/${EXECUTOR_REGISTRY}`}
            target="_blank"
            rel="noreferrer"
          >
            ExecutorRegistry ↗
          </a>
          <span className="proof-sep">·</span>
          <a href={`https://sepolia.etherscan.io/tx/${LAST_KNOWN_TX}`} target="_blank" rel="noreferrer">
            last state transition ↗
          </a>
        </div>
      </header>

      <section className="system">
        <div className="system-header">
          <span className="eyebrow">Live system</span>
        </div>

        <hr className="hr" />

        <div className="row row-animated" style={{ ["--i" as string]: 0 }}>
          <span className="label">Agent</span>
          <span className="value">
            {name ? `${name.label}.eth` : DEMO_LABEL} <span className="tag live">live</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row row-animated" style={{ ["--i" as string]: 1 }}>
          <span className="label">Owner</span>
          <span className="value">
            {name ? short(name.owner) : "—"} <span className="tag live">live</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row row-animated" style={{ ["--i" as string]: 2 }}>
          <span className="label">Succession lock</span>
          <span className="value">
            {locked === null ? "—" : locked ? "engaged" : "not engaged"}{" "}
            <span className="tag live">live</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row row-animated" style={{ ["--i" as string]: 3 }}>
          <span className="label">Heartbeat</span>
          <span className="value">
            99.98% <span className="tag sim">simulated</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row row-animated" style={{ ["--i" as string]: 4 }}>
          <span className="label">Revenue</span>
          <span className="value">
            $12,481.23 <span className="tag sim">simulated</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row row-animated" style={{ ["--i" as string]: 5 }}>
          <span className="label">Obligations</span>
          <span className="value">
            3 active <span className="tag sim">simulated</span>
          </span>
        </div>
      </section>

      <section className="lifecycle-section">
        <div className="lifecycle">
          <div
            className={`node ${statusClass === "active" ? "current" : ""}`}
            style={{ ["--active-color" as string]: "var(--active)" }}
          >
            <span className="ring" />
            Active
          </div>
          <div className="connector" />
          <div className={`node ${statusClass === "administration" ? "current" : ""}`} style={{ ["--active-color" as string]: "var(--administration)" }}>
            <span className="ring" />
            Administration
          </div>
          <div className="connector" />
          <div className={`node ${statusClass === "liquidation" ? "current" : ""}`} style={{ ["--active-color" as string]: "var(--liquidation)" }}>
            <span className="ring" />
            Liquidation
          </div>
          <div className="connector" />
          <div className={`node ${statusClass === "resolved" ? "current" : ""}`} style={{ ["--active-color" as string]: "var(--succession)" }}>
            <span className="ring" />
            Succession
          </div>
        </div>
      </section>

      <style>{`
        .overview {
          max-width: 640px;
          margin: 0 auto;
          padding: 56px 24px 64px;
        }
        .hero {
          margin-bottom: 56px;
        }
        .wordmark {
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.32em;
          color: var(--dim);
          margin-bottom: 20px;
        }

        /* The status is the thesis of the whole product - it gets to be the
           loudest thing on the page, not a small pill buried in a table. */
        .hero-status {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          font-family: var(--mono);
        }
        .hero-status-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
        }
        .hero-status-label {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .hero-status.active .hero-status-dot {
          background: var(--active);
          box-shadow: 0 0 18px 2px var(--active);
          animation: live-pulse 2.2s ease-in-out infinite;
        }
        .hero-status.active .hero-status-label {
          color: var(--active);
        }
        .hero-status.administration .hero-status-dot {
          background: var(--administration);
          box-shadow: 0 0 18px 2px var(--administration);
        }
        .hero-status.administration .hero-status-label {
          color: var(--administration);
        }
        .hero-status.liquidation .hero-status-dot {
          background: var(--liquidation);
          box-shadow: 0 0 18px 2px var(--liquidation);
        }
        .hero-status.liquidation .hero-status-label {
          color: var(--liquidation);
        }

        h1 {
          font-family: var(--sans);
          font-size: 34px;
          font-weight: 600;
          line-height: 1.25;
          letter-spacing: -0.01em;
          margin: 0 0 28px;
          text-wrap: balance;
        }
        .cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .cta {
          display: inline-block;
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--text);
          border: 1px solid var(--border-strong);
          padding: 10px 18px;
          border-radius: 4px;
        }
        .cta:hover {
          border-color: var(--succession);
          color: var(--succession);
        }
        .cta.ghost {
          color: var(--faint);
          border-style: dashed;
        }
        .cta.ghost:hover {
          color: var(--succession);
          border-color: var(--succession);
        }
        .proof-strip {
          margin-top: 20px;
          font-size: 11px;
          color: var(--faint);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .proof-label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .proof-strip a {
          color: var(--succession);
        }
        .proof-sep {
          color: var(--border-strong);
        }
        .system {
          margin-bottom: 64px;
        }
        .system-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--faint);
        }
        .lifecycle-section {
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </main>
  );
}

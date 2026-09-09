import Link from "next/link";
import {
  getNameState,
  hasRole,
  ROLE_SET_RESOLVER_ADMIN,
  getAgentStatus,
  getAgentPlan,
  getPaymentDestination,
  EXECUTOR_REGISTRY,
} from "../lib/ens";

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
  const [name, status, plan, destination] = await Promise.all([
    getNameState(DEMO_LABEL).catch(() => null),
    getAgentStatus().catch(() => null),
    getAgentPlan().catch(() => null),
    getPaymentDestination().catch(() => null),
  ]);
  const locked = name ? !(await hasRole(name.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR)) : null;
  const statusClass = status ?? "active";
  const toEstate = !!(plan && destination && destination.toLowerCase() === plan.estate.toLowerCase());

  return (
    <main className="overview">
      <header className="hero">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          EXECUTOR
        </div>

        <div className={`hero-status ${statusClass}`}>
          <span className="hero-status-dot" />
          <span className="hero-status-label">{status ?? "reading chain…"}</span>
        </div>

        <h1>
          When an agent fails,
          <br />
          its obligations <em>don&rsquo;t.</em>
        </h1>
        <p className="sub">
          A living will for autonomous agents. When the heartbeat stops, its payment
          destination flips on-chain — no human in the loop, no missed payout.
        </p>

        <div className="cta-row">
          <Link href="/vitals" className="cta primary pressable">
            WATCH THE FLIP →
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

      <section className="flow-section">
        <div className="section-header">
          <span className="eyebrow">The mechanism</span>
          <span className="tag live">live</span>
        </div>
        <hr className="hr" />

        <div className="flow">
          <div className={`flow-box ${!toEstate ? "on" : ""}`}>
            <span className="flow-box-label">Treasury</span>
            <span className="flow-box-addr mono">{plan ? short(plan.treasury) : "—"}</span>
            <span className="flow-box-tag">pays out while active</span>
          </div>

          <div className="flow-arrow" aria-hidden="true">
            <svg viewBox="0 0 120 24" width="100%" height="24" preserveAspectRatio="none">
              <line x1="2" y1="12" x2="108" y2="12" className="flow-line" />
              <path d="M100 4 L114 12 L100 20" className="flow-head" fill="none" />
            </svg>
            <span className="flow-arrow-label mono">on heartbeat failure</span>
          </div>

          <div className={`flow-box ${toEstate ? "on" : ""}`}>
            <span className="flow-box-label">Estate</span>
            <span className="flow-box-addr mono">{plan ? short(plan.estate) : "—"}</span>
            <span className="flow-box-tag">receives after grace period lapses</span>
          </div>
        </div>

        <div className="flow-current mono">
          getPaymentDestination() currently resolves to{" "}
          <strong>{toEstate ? "the estate" : "the treasury"}</strong>
          {destination ? ` — ${short(destination)}` : ""}
        </div>
      </section>

      <section className="system">
        <div className="section-header">
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
        <div className={`lifecycle lifecycle-${statusClass}`}>
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
          max-width: 760px;
          margin: 0 auto;
          padding: 64px 24px 72px;
        }
        .hero {
          margin-bottom: 64px;
        }
        .wordmark {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.32em;
          color: var(--dim);
          margin-bottom: 24px;
        }
        .wordmark-mark {
          width: 8px;
          height: 8px;
          background: var(--succession);
          box-shadow: 0 0 10px var(--succession);
        }

        /* The status is the thesis of the whole product - it gets to be the
           loudest thing on the page, not a small pill buried in a table. */
        .hero-status {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
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
          font-size: 52px;
          font-weight: 600;
          line-height: 1.12;
          letter-spacing: -0.02em;
          margin: 0 0 20px;
          text-wrap: balance;
        }
        h1 em {
          font-style: normal;
          color: var(--succession);
        }
        .sub {
          font-size: 16px;
          line-height: 1.55;
          color: var(--dim);
          max-width: 480px;
          margin: 0 0 32px;
        }
        .cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }
        .cta {
          display: inline-block;
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 12px 20px;
          border-radius: 4px;
        }
        .cta.primary {
          color: var(--bg);
          background: var(--succession);
          border: 1px solid var(--succession);
        }
        .cta.primary:hover {
          color: var(--bg);
          filter: brightness(1.1);
        }
        .cta.ghost {
          color: var(--faint);
          border: 1px solid var(--border-strong);
          border-style: dashed;
        }
        .cta.ghost:hover {
          color: var(--succession);
          border-color: var(--succession);
        }
        .proof-strip {
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

        .section-header {
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

        .flow-section {
          margin-bottom: 56px;
        }
        .flow {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          padding: 32px 0 20px;
        }
        .flow-box {
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: border-color 300ms var(--ease-settle), box-shadow 300ms var(--ease-settle),
            background 300ms var(--ease-settle);
        }
        .flow-box-label {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--faint);
        }
        .flow-box-addr {
          font-size: 17px;
          font-weight: 600;
        }
        .flow-box-tag {
          font-size: 11px;
          color: var(--faint);
        }
        .flow-box.on {
          border-color: var(--active);
          background: color-mix(in srgb, var(--active) 6%, transparent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--active) 40%, transparent);
        }
        .flow-box.on .flow-box-label {
          color: var(--active);
        }
        .flow-arrow {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 0 4px;
        }
        .flow-line {
          stroke: var(--border-strong);
          stroke-width: 1.5;
        }
        .flow-head {
          stroke: var(--border-strong);
          stroke-width: 1.5;
        }
        .flow-arrow-label {
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--faint);
          white-space: nowrap;
        }
        .flow-current {
          font-size: 12px;
          color: var(--faint);
        }
        .flow-current strong {
          color: var(--text);
        }

        .system {
          margin-bottom: 64px;
        }
        .lifecycle-section {
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }
        .lifecycle .connector {
          background: var(--border-strong);
        }
        .lifecycle-administration .connector:first-of-type,
        .lifecycle-liquidation .connector,
        .lifecycle-resolved .connector {
          background: color-mix(in srgb, var(--administration) 50%, var(--border-strong));
        }

        @media (max-width: 560px) {
          h1 {
            font-size: 36px;
          }
          .flow {
            grid-template-columns: 1fr;
          }
          .flow-arrow svg {
            transform: rotate(90deg);
          }
        }
      `}</style>
    </main>
  );
}

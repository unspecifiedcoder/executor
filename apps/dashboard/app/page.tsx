import Link from "next/link";
import {
  getNameState,
  hasRole,
  ROLE_SET_RESOLVER_ADMIN,
  getAgentStatus,
  getAgentPlan,
  getPaymentDestination,
  getAgentEvents,
  EXECUTOR_REGISTRY,
  AGENT_ID,
} from "../lib/ens";
import FlowPanel from "./components/FlowPanel";
import EventTimeline from "./components/EventTimeline";

const DEMO_LABEL = "executor-hackathon-demo";
const OPERATOR = "0x72db032c0dfb6e7502e16a73fabdab31712dc706" as const;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const revalidate = 30;

export default async function OverviewPage() {
  const [name, status, plan, destination, events] = await Promise.all([
    getNameState(DEMO_LABEL).catch(() => null),
    getAgentStatus().catch(() => null),
    getAgentPlan().catch(() => null),
    getPaymentDestination().catch(() => null),
    getAgentEvents().catch(() => []),
  ]);
  const locked = name ? !(await hasRole(name.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR)) : null;
  const statusClass = status ?? "active";

  return (
    <main className="overview">
      <header className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
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
              destination flips on-chain — no human in the loop, no missed payout. Watch it happen
              on the panel to the right, using this agent&rsquo;s real state right now.
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
              <Link href={`/agent/${AGENT_ID}`}>agent proof page →</Link>
            </div>
          </div>

          <div className="hero-panel">
            {plan && destination ? (
              <FlowPanel
                treasury={plan.treasury}
                estate={plan.estate}
                destination={destination}
                status={plan.status}
                lastHeartbeat={plan.lastHeartbeat}
                eligibleAt={plan.eligibleAt}
                heartbeatInterval={plan.heartbeatInterval}
                gracePeriod={plan.gracePeriod}
                planLocked={plan.planLocked}
              />
            ) : (
              <div className="panel-loading mono">reading chain…</div>
            )}
          </div>
        </div>
      </header>

      <section className="system">
        <div className="section-header">
          <span className="eyebrow">On-chain history</span>
          <span className="tag live">live</span>
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

        <div className="timeline-wrap">
          <EventTimeline events={events} />
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
          max-width: 960px;
          margin: 0 auto;
          padding: 48px 24px 72px;
        }
        .hero {
          margin-bottom: 64px;
        }
        .hero-grid {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 48px;
          align-items: start;
        }

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
          font-size: 46px;
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

        .hero-panel {
          position: sticky;
          top: 80px;
        }
        .panel-loading {
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          color: var(--faint);
          font-size: 12px;
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

        .system {
          margin-bottom: 56px;
        }
        .timeline-wrap {
          margin-top: 8px;
        }

        .lifecycle-section {
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }
        .lifecycle .connector {
          background: var(--border-strong);
        }

        @media (max-width: 860px) {
          .hero-grid {
            grid-template-columns: 1fr;
          }
          .hero-panel {
            position: static;
          }
        }
        @media (max-width: 560px) {
          h1 {
            font-size: 34px;
          }
        }
      `}</style>
    </main>
  );
}

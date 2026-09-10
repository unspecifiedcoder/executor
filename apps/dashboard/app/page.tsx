import Link from "next/link";
import {
  getNameState,
  hasRole,
  ROLE_SET_RESOLVER_ADMIN,
  getAgentStatus,
  getAgentPlan,
  getPaymentDestination,
  EXECUTOR_REGISTRY,
  AGENT_ID,
} from "../lib/ens";
import type { AgentEvent } from "../lib/ens";
import { getAgentHistory, getIndexMeta } from "../lib/subgraph";
import FlowPanel from "./components/FlowPanel";
import EventTimeline from "./components/EventTimeline";

const DEMO_LABEL = "executor-hackathon-demo";
const OPERATOR = "0x72db032c0dfb6e7502e16a73fabdab31712dc706" as const;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const metadata = {
  // `app/page.tsx` shares a segment with the root layout, so the layout's
  // `%s — Executor` template does not apply here. Spelled out instead.
  title: "Overview — Executor",
  description: "One contract, one x402 gateway, one ENSv2 name - and what each of them proves.",
};

export const revalidate = 30;

/** An RPC failure and an empty result are different facts, and a panel labelled
 * `live` has to be able to tell them apart. Everything read here is wrapped so a
 * failure carries its reason into the UI instead of collapsing into `null`/`[]`. */
type Read<T> = { ok: true; value: T } | { ok: false; error: string };

async function read<T>(promise: Promise<T>): Promise<Read<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function OverviewPage() {
  // History and liveness statistics come from the subgraph, not from a chunked
  // eth_getLogs scan. Current state (status, plan, destination) still comes
  // straight from the contract: those are single cheap reads where the chain is
  // authoritative and an index would only add staleness.
  const [name, status, plan, destination, history, indexMeta] = await Promise.all([
    read(getNameState(DEMO_LABEL)),
    read(getAgentStatus()),
    read(getAgentPlan()),
    read(getPaymentDestination()),
    read(getAgentHistory(AGENT_ID)),
    read(getIndexMeta()),
  ]);
  const events: Read<AgentEvent[]> = history.ok
    ? { ok: true, value: history.value.events }
    : { ok: false, error: history.error };
  const vitals = history.ok ? history.value.vitals : null;
  const locked: Read<boolean> = name.ok
    ? await read(
        hasRole(name.value.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR).then((held) => !held),
      )
    : { ok: false, error: name.error };
  const statusClass = status.ok ? status.value : "active";

  return (
    <main className="overview">
      <header className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className={`hero-status ${statusClass}`}>
              <span className="hero-status-dot" />
              <span className="hero-status-label">
                {status.ok ? status.value : "chain unreachable"}
              </span>
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
            {plan.ok && destination.ok ? (
              <FlowPanel
                treasury={plan.value.treasury}
                estate={plan.value.estate}
                destination={destination.value}
                status={plan.value.status}
                lastHeartbeat={plan.value.lastHeartbeat}
                eligibleAt={plan.value.eligibleAt}
                heartbeatInterval={plan.value.heartbeatInterval}
                gracePeriod={plan.value.gracePeriod}
                planLocked={plan.value.planLocked}
              />
            ) : (
              <div className="panel-error mono">
                <strong>Could not read the registry.</strong>
                <span>
                  {!plan.ok ? plan.error : !destination.ok ? destination.error : "unknown error"}
                </span>
                <span className="panel-error-note">
                  This panel is a live Sepolia read — it is showing an error, not a state.
                </span>
              </div>
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
            {name.ok ? (
              <>
                {`${name.value.label}.eth`} <span className="tag live">live</span>
              </>
            ) : (
              <span className="tag error">read failed</span>
            )}
          </span>
        </div>
        <hr className="hr" />
        <div className="row row-animated" style={{ ["--i" as string]: 1 }}>
          <span className="label">Owner</span>
          <span className="value">
            {name.ok ? (
              <>
                {short(name.value.owner)} <span className="tag live">live</span>
              </>
            ) : (
              <span className="tag error">read failed</span>
            )}
          </span>
        </div>
        <hr className="hr" />
        <div className="row row-animated" style={{ ["--i" as string]: 2 }}>
          <span className="label">Succession lock</span>
          <span className="value">
            {locked.ok ? (
              <>
                {locked.value ? "engaged" : "not engaged"} <span className="tag live">live</span>
              </>
            ) : (
              <span className="tag error">read failed</span>
            )}
          </span>
        </div>

        {!name.ok && <p className="read-error mono">ENS registry read failed: {name.error}</p>}

        {vitals && (
          <div className="vitals-strip">
            <div className="vitals-head">
              <span className="label">Liveness history</span>
              <span className="vitals-source mono">
                indexed by The Graph
                {indexMeta.ok ? ` · block ${indexMeta.value.block.toLocaleString()}` : ""}
              </span>
            </div>
            <div className="vitals-row">
              <div className="vital">
                <span className="vital-label">Heartbeats</span>
                <span className="vital-value mono">{vitals.heartbeatCount}</span>
              </div>
              <div className="vital">
                <span className="vital-label">Median gap</span>
                <span className="vital-value mono">
                  {vitals.medianGapSeconds === null ? "—" : `${vitals.medianGapSeconds}s`}
                </span>
              </div>
              <div className="vital">
                <span className="vital-label">Longest gap</span>
                <span className="vital-value mono">
                  {vitals.longestGapSeconds === null ? "—" : `${vitals.longestGapSeconds}s`}
                </span>
              </div>
              <div className="vital">
                <span className="vital-label">Deadline</span>
                <span className="vital-value mono">
                  {plan.ok
                    ? `${Number(plan.value.heartbeatInterval) + Number(plan.value.gracePeriod)}s`
                    : "—"}
                </span>
              </div>
            </div>
            <p className="vitals-note">
              A median and a maximum are aggregates over the agent&rsquo;s whole heartbeat
              series, which is why they come from an index rather than a contract call. They
              describe what the cadence was &mdash; not proof the agent was doing work, since a
              regular cadence is cheap to manufacture.
            </p>
          </div>
        )}

        <div className="timeline-wrap">
          {events.ok ? (
            <EventTimeline events={events.value} />
          ) : (
            <div className="panel-error mono">
              <strong>Could not load on-chain history.</strong>
              <span>{events.error}</span>
              <span className="panel-error-note">
                The index is unreachable. This is deliberately not falling back to an RPC scan:
                a silent fallback would show plausible history while the labelled source is
                broken, which is the failure this replaced.
              </span>
            </div>
          )}
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
          font-size: clamp(40px, 6vw, 84px);
          font-weight: 800;
          line-height: 0.98;
          letter-spacing: -0.03em;
          margin: 0 0 24px;
          text-wrap: balance;
        }
        h1 em {
          font-style: normal;
          color: var(--active);
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
        .panel-error {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid var(--liquidation);
          border-radius: 8px;
          padding: 20px;
          font-size: 11px;
          line-height: 1.5;
          color: var(--dim);
          background: color-mix(in srgb, var(--liquidation) 7%, transparent);
          overflow-wrap: anywhere;
        }
        .panel-error strong {
          color: var(--liquidation);
          font-size: 12px;
        }
        .panel-error-note {
          color: var(--faint);
        }
        .read-error {
          font-size: 11px;
          color: var(--liquidation);
          margin: 12px 0 0;
          overflow-wrap: anywhere;
        }
        .tag.error {
          color: var(--liquidation);
          border-color: var(--liquidation);
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

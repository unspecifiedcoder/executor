import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress, isHex, zeroAddress, type Hex } from "viem";
import { getAgentPlan, getPaymentDestination, EXECUTOR_REGISTRY } from "../../../lib/ens";
import { getAgentHistory } from "../../../lib/subgraph";
import FlowPanel from "../../components/FlowPanel";
import EventTimeline from "../../components/EventTimeline";
import SyncingBar from "../../components/SyncingBar";
import HeartbeatButton from "./HeartbeatButton";
import { Suspense } from "react";

/** Rendered inside a `<Suspense>` so an RPC failure here shows as an error state
 * rather than as an empty timeline. */
async function AgentHistory({ id }: { id: Hex }) {
  try {
    const events = (await getAgentHistory(id)).events;
    return <EventTimeline events={events} />;
  } catch (err) {
    return (
      <div className="agent-read-error mono">
        <strong>Could not load on-chain history.</strong>
        <span>{err instanceof Error ? err.message : String(err)}</span>
        <span>This is an RPC failure, not an empty history.</span>
      </div>
    );
  }
}

export const revalidate = 15;

export function generateMetadata({ params }: { params: { agentId: string } }): Metadata {
  const { agentId } = params;
  const label =
    isHex(agentId) && agentId.length === 66
      ? `${agentId.slice(0, 10)}…${agentId.slice(-6)}`
      : "Unknown agent";
  return {
    title: `Agent ${label}`,
    description: "Live registry read of one agent's resolution plan and on-chain history.",
  };
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function AgentPage({ params }: { params: { agentId: string } }) {
  const { agentId } = params;
  if (!isHex(agentId) || agentId.length !== 66) notFound();

  const id = agentId as Hex;

  // `getAgentPlan` is awaited on its own and deliberately NOT caught: an
  // unregistered agent comes back as a zero-address owner, so a thrown error
  // here means the RPC failed. Swallowing it would render "no such agent" for
  // what is really an outage.
  const plan = await getAgentPlan(id);
  if (plan.owner === zeroAddress) notFound();

  const destination = await getPaymentDestination(id).catch(() => null);

  return (
    <main className="agent-page">
      <Link href="/" className="back pressable">
        ← EXECUTOR
      </Link>

      <div className="header">
        <span className="eyebrow">Agent proof</span>
        <h1 className="mono">
          {id.slice(0, 10)}…{id.slice(-6)}
        </h1>
        <p className="sub">
          Any agent registered on this ExecutorRegistry gets this page for free — a public, live
          read of its plan and history. A payment gateway can read{" "}
          <span className="mono">getPaymentDestination({id.slice(0, 8)}…)</span> the same way our
          demo does; our gateway then resolves that address to a Hedera account through the mirror
          node, which works for any destination that has one.
        </p>
      </div>

      {destination && (
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
      )}

      <HeartbeatButton agentId={id} heartbeatSigner={plan.heartbeatSigner} />

      <section className="details">
        <div className="section-header">
          <span className="eyebrow">Plan</span>
          <span className="tag live">live</span>
        </div>
        <hr className="hr" />
        <div className="row">
          <span className="label">Owner</span>
          <span className="value mono">{short(plan.owner)}</span>
        </div>
        <hr className="hr" />
        <div className="row">
          <span className="label">Status</span>
          <span className="value">{plan.status}</span>
        </div>
        <hr className="hr" />
        <div className="row">
          <span className="label">Plan locked</span>
          <span className="value">{plan.planLocked ? "yes" : "no"}</span>
        </div>
      </section>

      <section className="history">
        <div className="section-header">
          <span className="eyebrow">On-chain history</span>
          <span className="tag live">live</span>
        </div>
        <hr className="hr" />
        {/* Streamed separately: the log scan is the slowest read on the page, and
            keeping it out of the initial await is what lets `notFound()` above
            settle a real 404 status before anything is flushed. */}
        <Suspense fallback={<SyncingBar label="READING ON-CHAIN HISTORY" />}>
          <AgentHistory id={id} />
        </Suspense>
      </section>

      <p className="registry-note mono">
        <a href={`https://sepolia.etherscan.io/address/${EXECUTOR_REGISTRY}`} target="_blank" rel="noreferrer">
          ExecutorRegistry {short(EXECUTOR_REGISTRY)} ↗
        </a>
      </p>

      <style>{`
        .agent-page {
          max-width: 640px;
          margin: 0 auto;
          padding: 32px 24px 64px;
        }
        .back {
          font-family: var(--mono);
          font-size: 12px;
          letter-spacing: 0.08em;
          color: var(--faint);
        }
        .back:hover {
          color: var(--succession);
        }
        .agent-read-error {
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
        .agent-read-error strong {
          color: var(--liquidation);
          font-size: 12px;
        }
        .header {
          margin: 32px 0 28px;
        }
        .eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--faint);
        }
        h1 {
          font-size: 22px;
          font-weight: 600;
          margin: 10px 0 14px;
        }
        .sub {
          font-size: 13px;
          color: var(--dim);
          line-height: 1.6;
          max-width: 520px;
        }
        .sub .mono {
          color: var(--text);
        }
        .details, .history {
          margin-top: 40px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
        }
        .row .label {
          color: var(--dim);
          font-size: 13px;
        }
        .row .value {
          font-family: var(--mono);
          font-size: 13px;
        }
        .registry-note {
          margin-top: 32px;
          font-size: 11px;
        }
        .registry-note a {
          color: var(--faint);
        }
        .registry-note a:hover {
          color: var(--succession);
        }
      `}</style>
    </main>
  );
}

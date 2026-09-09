import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress, isHex, zeroAddress, type Hex } from "viem";
import { getAgentPlan, getPaymentDestination, getAgentEvents, EXECUTOR_REGISTRY } from "../../../lib/ens";
import FlowPanel from "../../components/FlowPanel";
import EventTimeline from "../../components/EventTimeline";
import HeartbeatButton from "./HeartbeatButton";

export const revalidate = 15;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function AgentPage({ params }: { params: { agentId: string } }) {
  const { agentId } = params;
  if (!isHex(agentId) || agentId.length !== 66) notFound();

  const id = agentId as Hex;
  const [plan, destination, events] = await Promise.all([
    getAgentPlan(id).catch(() => null),
    getPaymentDestination(id).catch(() => null),
    getAgentEvents(id).catch(() => []),
  ]);

  if (!plan || plan.owner === zeroAddress) notFound();

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
          read of its plan and history. Anyone can build a payment gateway against{" "}
          <span className="mono">getPaymentDestination({id.slice(0, 8)}…)</span> the same way our
          demo does.
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
        <EventTimeline events={events} />
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

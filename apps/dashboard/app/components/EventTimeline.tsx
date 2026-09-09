import type { AgentEvent } from "../../lib/ens";

function short(addr: unknown): string {
  const s = String(addr);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

const STATUS_LABEL = ["active", "administration", "liquidation", "resolved"];

function describe(ev: AgentEvent): string {
  switch (ev.name) {
    case "AgentRegistered":
      return `registered — treasury ${short(ev.args.treasury)}, estate ${short(ev.args.estate)}`;
    case "PlanLocked":
      return "plan locked — treasury/estate/trustee/timing now immutable";
    case "Heartbeat":
      return "heartbeat received";
    case "StatusChanged":
      return `status → ${STATUS_LABEL[Number(ev.args.status)] ?? ev.args.status}`;
    case "PaymentDestinationChanged":
      return `payTo → ${short(ev.args.destination)}`;
    default:
      return ev.name;
  }
}

function relTime(unixSeconds: number, nowSeconds: number): string {
  const diff = nowSeconds - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Real on-chain history for one agent, decoded from ExecutorRegistry's own
 * events - replaces the old panel of hand-typed "simulated" KPIs with rows
 * that are literally what happened, in order, each linked to its tx. */
export default function EventTimeline({ events }: { events: AgentEvent[] }) {
  const now = Math.floor(Date.now() / 1000);

  if (events.length === 0) {
    return <div className="timeline-empty mono">No on-chain events yet for this agent.</div>;
  }

  return (
    <div className="timeline">
      {events.map((ev, i) => (
        <a
          key={`${ev.transactionHash}-${i}`}
          href={`https://sepolia.etherscan.io/tx/${ev.transactionHash}`}
          target="_blank"
          rel="noreferrer"
          className="timeline-row row-animated"
          style={{ ["--i" as string]: i }}
        >
          <span className={`timeline-dot dot-${ev.name}`} />
          <span className="timeline-desc">{describe(ev)}</span>
          <span className="timeline-meta mono">
            block {ev.blockNumber.toString()} · {relTime(ev.timestamp, now)} ↗
          </span>
        </a>
      ))}

      <style>{`
        .timeline {
          display: flex;
          flex-direction: column;
        }
        .timeline-empty {
          font-size: 12px;
          color: var(--faint);
          padding: 16px 0;
        }
        .timeline-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }
        .timeline-row:hover {
          color: var(--succession);
        }
        .timeline-row:hover .timeline-meta {
          color: var(--succession);
        }
        .timeline-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          background: var(--faint);
        }
        .dot-AgentRegistered,
        .dot-PlanLocked {
          background: var(--succession);
        }
        .dot-Heartbeat {
          background: var(--active);
        }
        .dot-StatusChanged,
        .dot-PaymentDestinationChanged {
          background: var(--administration);
        }
        .timeline-desc {
          font-size: 13px;
          flex: 1;
          min-width: 0;
        }
        .timeline-meta {
          font-size: 11px;
          color: var(--faint);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

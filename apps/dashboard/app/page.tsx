import Link from "next/link";
import { getNameState, hasRole, ROLE_SET_RESOLVER_ADMIN } from "../lib/ens";

const DEMO_LABEL = "executor-hackathon-demo";
const OPERATOR = "0x72db032c0dfb6e7502e16a73fabdab31712dc706" as const;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const revalidate = 30;

export default async function OverviewPage() {
  const name = await getNameState(DEMO_LABEL).catch(() => null);
  const locked = name ? !(await hasRole(name.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR)) : null;

  return (
    <main className="overview">
      <header className="hero">
        <div className="wordmark">EXECUTOR</div>
        <h1>
          When an agent fails,
          <br />
          its obligations don&rsquo;t.
        </h1>
        <Link href="/vitals" className="cta">
          VIEW LIVE AGENT →
        </Link>
      </header>

      <section className="system">
        <div className="system-header">
          <span className="eyebrow">Live system</span>
          <span className="status active">
            <span className="dot" />
            active
          </span>
        </div>

        <hr className="hr" />

        <div className="row">
          <span className="label">Agent</span>
          <span className="value">
            {name ? `${name.label}.eth` : DEMO_LABEL} <span className="tag live">live</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row">
          <span className="label">Owner</span>
          <span className="value">
            {name ? short(name.owner) : "—"} <span className="tag live">live</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row">
          <span className="label">Succession lock</span>
          <span className="value">
            {locked === null ? "—" : locked ? "engaged" : "not engaged"}{" "}
            <span className="tag live">live</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row">
          <span className="label">Heartbeat</span>
          <span className="value">
            99.98% <span className="tag sim">simulated</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row">
          <span className="label">Revenue</span>
          <span className="value">
            $12,481.23 <span className="tag sim">simulated</span>
          </span>
        </div>
        <hr className="hr" />

        <div className="row">
          <span className="label">Obligations</span>
          <span className="value">
            3 active <span className="tag sim">simulated</span>
          </span>
        </div>
      </section>

      <section className="lifecycle-section">
        <div className="lifecycle">
          <div className="node current" style={{ ["--active-color" as string]: "var(--active)" }}>
            <span className="ring" />
            Active
          </div>
          <div className="connector" />
          <div className="node">
            <span className="ring" />
            Administration
          </div>
          <div className="connector" />
          <div className="node">
            <span className="ring" />
            Liquidation
          </div>
          <div className="connector" />
          <div className="node">
            <span className="ring" />
            Succession
          </div>
        </div>
      </section>

      <style>{`
        .overview {
          max-width: 640px;
          margin: 0 auto;
          padding: 88px 24px 64px;
        }
        .hero {
          margin-bottom: 72px;
        }
        .wordmark {
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.32em;
          color: var(--dim);
          margin-bottom: 28px;
        }
        h1 {
          font-family: var(--sans);
          font-size: 34px;
          font-weight: 600;
          line-height: 1.25;
          letter-spacing: -0.01em;
          margin: 0 0 32px;
          text-wrap: balance;
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
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .cta:hover {
          border-color: var(--succession);
          color: var(--succession);
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

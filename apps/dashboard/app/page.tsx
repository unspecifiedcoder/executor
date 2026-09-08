import { getNameState, hasRole, ROLE_SET_RESOLVER, ROLE_SET_RESOLVER_ADMIN } from "../lib/ens";

// Real values from the Day-1 spike run against Sepolia (see README for tx hashes).
// Hardcoded rather than parameterized: this page's job right now is to prove the
// on-chain state is real and readable, not to be a generic multi-estate viewer.
const DEMO_LABEL = "executor-hackathon-demo";
const OPERATOR = "0x72db032c0dfb6e7502e16a73fabdab31712dc706" as const;
const DELEGATE = "0xaaa11adf8ffda3fa6d0d02d815454286045c1488" as const;

function short(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const revalidate = 30;

export default async function VitalSignsPage() {
  let content: React.ReactNode;

  try {
    const name = await getNameState(DEMO_LABEL);
    const [delegateHasRole, operatorHasAdmin] = await Promise.all([
      hasRole(name.tokenId, ROLE_SET_RESOLVER, DELEGATE),
      hasRole(name.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR),
    ]);

    content = (
      <div className="grid">
        <section className="panel">
          <h2>Name card</h2>
          <div className="row">
            <span className="label">Name</span>
            <span className="mono">{name.label}.eth</span>
          </div>
          <div className="row">
            <span className="label">Owner</span>
            <span className="mono">{short(name.owner)}</span>
          </div>
          <div className="row">
            <span className="label">Registry</span>
            <span className="mono">
              <a
                href="https://sepolia.etherscan.io/address/0x67b728a792e789A8978B30Cf1B3B641f19354b43"
                target="_blank"
                rel="noreferrer"
              >
                ETHRegistry ↗
              </a>
            </span>
          </div>
          <div className="row">
            <span className="label">Expires</span>
            <span className="mono">{name.expiryDate.slice(0, 10)}</span>
          </div>
        </section>

        <section className="panel">
          <h2>Living will status</h2>
          <div className="row">
            <span className="label">
              <span className={`dot ${delegateHasRole ? "green" : "red"}`} />
              Delegate holds ROLE_SET_RESOLVER
            </span>
            <span className="mono">{delegateHasRole ? "yes" : "no"}</span>
          </div>
          <div className="row">
            <span className="label">
              <span className={`dot ${operatorHasAdmin ? "red" : "green"}`} />
              Operator still holds admin
            </span>
            <span className="mono">
              {operatorHasAdmin ? "yes (not locked)" : "no"}{" "}
              {!operatorHasAdmin && <span className="badge locked">locked</span>}
            </span>
          </div>
          <div className="row">
            <span className="label">Delegate</span>
            <span className="mono">{short(DELEGATE)}</span>
          </div>
        </section>

        <section className="panel">
          <h2>Heartbeat</h2>
          <div className="row">
            <span className="label">
              <span className="dot amber" />
              Receiver contract
            </span>
            <span className="mono">not deployed yet</span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
            This panel goes live once Receiver.sol is deployed to Sepolia and
            agent-debtor starts sending signed ping()s.
          </p>
        </section>

        <section className="panel">
          <h2>Creditors</h2>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            No claims registered yet — Estate.sol isn't deployed to Arc, and no
            liquidation has been declared.
          </p>
        </section>
      </div>
    );
  } catch (err) {
    content = (
      <div className="panel">
        <p className="error">
          Failed to read on-chain state: {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    );
  }

  return (
    <main>
      <h1>Executor — Vital Signs</h1>
      {content}
    </main>
  );
}

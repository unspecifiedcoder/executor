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
import { getAgentHistory, getIndexMeta, getSettledEstate } from "../lib/subgraph";
import { AGENT3_ID } from "../lib/proof";
import LifecycleReplay from "./components/LifecycleReplay";

const DEMO_LABEL = "executor-hackathon-demo";
const OPERATOR = "0x72db032c0dfb6e7502e16a73fabdab31712dc706" as const;

export const metadata = {
  title: "Overview — Executor",
  description:
    "The destination of a payment is late-bound to the payee's on-chain liveness. Replay the Sepolia proof.",
};

export const revalidate = 30;

type Read<T> = { ok: true; value: T } | { ok: false; error: string };
async function read<T>(p: Promise<T>): Promise<Read<T>> {
  try {
    return { ok: true, value: await p };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function OverviewPage() {
  // The replay is historical and drives the page. These reads are about the
  // *live* agent, and feed the pilot light and the footer only - the point of
  // the pilot light is that something is genuinely beating right now while the
  // replay tells a story about an agent that stopped.
  const [name, status, plan, destination, history, indexMeta, settled] = await Promise.all([
    read(getNameState(DEMO_LABEL)),
    read(getAgentStatus()),
    read(getAgentPlan()),
    read(getPaymentDestination()),
    read(getAgentHistory(AGENT_ID)),
    read(getIndexMeta()),
    read(getSettledEstate(AGENT3_ID)),
  ]);

  const locked: Read<boolean> = name.ok
    ? await read(hasRole(name.value.tokenId, ROLE_SET_RESOLVER_ADMIN, OPERATOR).then((h) => !h))
    : { ok: false, error: name.error };

  const vitals = history.ok ? history.value.vitals : null;
  const claims = settled.ok && settled.value ? settled.value.claims : [];
  const shortfall = settled.ok && settled.value ? settled.value.shortfall : 0;

  return (
    <main className="overview">

      <LifecycleReplay
        claims={claims}
        shortfall={shortfall}
        live={{
          name: name.ok ? `${DEMO_LABEL}.eth` : "ENS read failed",
          status: status.ok ? status.value : "unknown",
          destination: destination.ok
            ? `${destination.value.slice(0, 6)}…${destination.value.slice(-4)}`
            : "read failed",
          lock: locked.ok ? (locked.value ? "engaged" : "not engaged") : "read failed",
          index: indexMeta.ok ? `block ${indexMeta.value.block.toLocaleString()}` : "unreachable",
          plan: plan.ok ? (plan.value.planLocked ? "locked ✓" : "unlocked") : "read failed",
        }}
      />


      <p className="bounds mono">
        heartbeat cadence ≠ proof of work · the registry&rsquo;s estate field is an EOA, the{" "}
        <code>Estate</code> contract is a separate venue · the ENS name resolves to the live agent,
        not the replayed one · a human trustee curates the claims ·{" "}
        <a href={`https://sepolia.etherscan.io/address/${EXECUTOR_REGISTRY}`} target="_blank" rel="noreferrer">
          registry ↗
        </a>
      </p>
    </main>
  );
}

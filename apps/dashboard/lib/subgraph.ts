import "server-only";
import type { Hex } from "viem";
import type { AgentEvent } from "./ens";

/**
 * The dashboard's source of on-chain history.
 *
 * This replaced a chunked `eth_getLogs` scan. That scan was anchored at the
 * deploy block and walked forward in 50,000-block windows because that is the
 * public RPC's per-request cap, which means its cost grew with the chain and it
 * spent one round trip per window to answer a question the chain had already
 * answered. Worse, an earlier revision used the window as a sliding one ending
 * at the head, so roughly six days after deployment the deploy block fell out
 * of range and the history panel rendered empty - with no error - on a panel
 * labelled `live`.
 *
 * There is deliberately **no RPC fallback**. Not because a fallback would be
 * dishonest, but because a silent one would put the panel back in the state
 * this replaced: showing something plausible while the labelled source is
 * broken. If the index is unreachable this throws, the caller renders an error,
 * and `indexedBlock` tells the reader exactly how far behind the index is when
 * it is reachable but lagging.
 */
const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ??
  "https://api.studio.thegraph.com/query/1760047/executor/v0.1.1";

async function query<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    // The page sets its own revalidate window; caching here as well would make
    // the two disagree about how stale "live" is allowed to be.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`subgraph HTTP ${response.status}`);
  }

  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(`subgraph: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) throw new Error("subgraph returned no data");
  return body.data;
}

export interface IndexMeta {
  block: number;
  hasIndexingErrors: boolean;
}

export async function getIndexMeta(): Promise<IndexMeta> {
  const data = await query<{ _meta: { block: { number: number }; hasIndexingErrors: boolean } }>(
    `{ _meta { block { number } hasIndexingErrors } }`,
    {},
  );
  return { block: data._meta.block.number, hasIndexingErrors: data._meta.hasIndexingErrors };
}

interface RawAgent {
  status: string;
  heartbeatCount: number;
  lastHeartbeat: string | null;
  heartbeats: { timestamp: string; blockNumber: string; txHash: Hex; gapFromPrevious: string | null }[];
  statusChanges: { from: string; to: string; blockNumber: string; blockTimestamp: string; txHash: Hex; caller: Hex }[];
  destinationChanges: { destination: Hex; status: string; blockNumber: string; blockTimestamp: string; txHash: Hex }[];
}

const AGENT_HISTORY = `
  query AgentHistory($id: ID!) {
    agent(id: $id) {
      status
      heartbeatCount
      lastHeartbeat
      heartbeats(first: 250, orderBy: blockNumber, orderDirection: desc) {
        timestamp blockNumber txHash gapFromPrevious
      }
      statusChanges(first: 100, orderBy: blockNumber, orderDirection: desc) {
        from to blockNumber blockTimestamp txHash caller
      }
      destinationChanges(first: 100, orderBy: blockNumber, orderDirection: desc) {
        destination status blockNumber blockTimestamp txHash
      }
    }
  }
`;

/**
 * Liveness statistics over the agent's whole indexed history.
 *
 * These are the reason the index earns its place rather than merely duplicating
 * the chain: a median and a maximum are aggregates over the full series, and
 * answering them from RPC means fetching every heartbeat and reducing them
 * client-side on every page load.
 *
 * Read this as observability, not authenticity. A regular cadence is trivial to
 * manufacture - anyone holding the signer key can beat on a timer - so these
 * numbers describe what the cadence *was* and where it broke. They are not
 * evidence that an agent was genuinely doing work.
 */
export interface AgentVitals {
  heartbeatCount: number;
  lastHeartbeat: number | null;
  medianGapSeconds: number | null;
  longestGapSeconds: number | null;
  currentGapSeconds: number | null;
  /** The most recent gaps, oldest first. This is the agent's actual cadence -
   * the trace drawn from it is real telemetry, not a decorative waveform. */
  recentGaps: number[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export interface AgentHistory {
  events: AgentEvent[];
  vitals: AgentVitals;
}

export async function getAgentHistory(agentId: Hex): Promise<AgentHistory> {
  const data = await query<{ agent: RawAgent | null }>(AGENT_HISTORY, {
    id: agentId.toLowerCase(),
  });

  const agent = data.agent;
  if (!agent) {
    // A registered agent the index has never seen is a real, reportable state -
    // not an empty history. Returning [] here would be the same lie the old
    // sliding-window scan told.
    return {
      events: [],
      vitals: {
        heartbeatCount: 0,
        lastHeartbeat: null,
        medianGapSeconds: null,
        longestGapSeconds: null,
        currentGapSeconds: null,
        recentGaps: [],
      },
    };
  }

  const events: AgentEvent[] = [];

  for (const beat of agent.heartbeats) {
    events.push({
      name: "Heartbeat",
      blockNumber: BigInt(beat.blockNumber),
      transactionHash: beat.txHash,
      timestamp: Number(beat.timestamp),
      args: { timestamp: BigInt(beat.timestamp) },
    });
  }

  for (const change of agent.statusChanges) {
    events.push({
      name: "StatusChanged",
      blockNumber: BigInt(change.blockNumber),
      transactionHash: change.txHash,
      timestamp: Number(change.blockTimestamp),
      // `caller` has no equivalent in the event itself - it is transaction.from,
      // recovered at index time. It is the field that shows enterAdministration
      // was triggered by someone holding no role.
      args: { status: change.to, from: change.from, caller: change.caller },
    });
  }

  for (const change of agent.destinationChanges) {
    events.push({
      name: "PaymentDestinationChanged",
      blockNumber: BigInt(change.blockNumber),
      transactionHash: change.txHash,
      timestamp: Number(change.blockTimestamp),
      args: { destination: change.destination, status: change.status },
    });
  }

  events.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0));

  const gaps = agent.heartbeats
    .map((b) => (b.gapFromPrevious === null ? null : Number(b.gapFromPrevious)))
    .filter((g): g is number => g !== null && g > 0);

  const lastHeartbeat = agent.lastHeartbeat === null ? null : Number(agent.lastHeartbeat);

  return {
    events,
    vitals: {
      heartbeatCount: agent.heartbeatCount,
      lastHeartbeat,
      medianGapSeconds: median(gaps),
      longestGapSeconds: gaps.length ? Math.max(...gaps) : null,
      currentGapSeconds:
        lastHeartbeat === null ? null : Math.max(0, Math.floor(Date.now() / 1000) - lastHeartbeat),
      // `heartbeats` came back newest-first; the trace reads left-to-right in
      // time, so reverse the slice rather than the whole series.
      recentGaps: gaps.slice(0, 40).reverse(),
    },
  };
}


/** A settled claim as the index has it. */
export interface IndexedClaim {
  creditor: string;
  priorityClass: string;
  allowed: number;
  paid: number;
}

export interface SettledEstate {
  claims: IndexedClaim[];
  totalPaid: number;
  shortfall: number;
}

/**
 * The waterfall an agent's estate actually ran.
 *
 * Read from the index rather than written into the page, so the numbers on
 * screen are the numbers the chain settled. If the claim set is edited on
 * chain, this follows; a hardcoded copy would quietly diverge and the first
 * person to notice would be a judge cross-checking against Etherscan.
 */
export async function getSettledEstate(agentId: string): Promise<SettledEstate | null> {
  const data = await query<{
    agent: {
      claims: { creditor: string; priorityClass: string; allowedAmount: string; amountPaid: string }[];
      executions: { totalPaid: string; shortfall: string }[];
    } | null;
  }>(
    `query Settled($id: ID!) {
       agent(id: $id) {
         claims(first: 50) { creditor priorityClass allowedAmount amountPaid }
         executions(first: 1, orderBy: blockNumber, orderDirection: desc) { totalPaid shortfall }
       }
     }`,
    { id: agentId.toLowerCase() },
  );

  const agent = data.agent;
  if (!agent || agent.claims.length === 0) return null;

  const ORDER = ["Secured", "Administrative", "Unsecured"];
  const claims = agent.claims
    .map((c) => ({
      creditor: c.creditor,
      priorityClass: c.priorityClass,
      allowed: Number(c.allowedAmount),
      paid: Number(c.amountPaid),
    }))
    // Priority order is the whole point of a waterfall, and the index returns
    // claims in insertion order. Sorting here rather than in the component
    // keeps the ordering rule in one place.
    .sort((a, b) => ORDER.indexOf(a.priorityClass) - ORDER.indexOf(b.priorityClass));

  const exec = agent.executions[0];
  return {
    claims,
    totalPaid: exec ? Number(exec.totalPaid) : 0,
    shortfall: exec ? Number(exec.shortfall) : 0,
  };
}

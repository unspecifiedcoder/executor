import {
  createPublicClient,
  http,
  numberToHex,
  parseEventLogs,
  toEventSelector,
  type Address,
  type Hex,
  type Log,
} from "viem";
import { sepolia } from "viem/chains";

/**
 * Real, verified ENSv2 Sepolia addresses (ensdomains/contracts-v2, main branch,
 * post-audit deployment - confirmed live via bytecode + working contract calls,
 * not taken on faith from the docs site, which was found to be stale).
 */
export const ETH_REGISTRAR = "0xa4449a0dd2b83007553d9b1d28b583a46a805a30" as const;
export const ETH_REGISTRY = "0x67b728a792e789a8978b30cf1b3b641f19354b43" as const;
export const MOCK_USDC = "0xd3322b29a7bdee707d1684676f149bf41aa3422f" as const;

export const ROLE_SET_RESOLVER = 1n << 24n;
export const ROLE_SET_RESOLVER_ADMIN = ROLE_SET_RESOLVER << 128n;

const client = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

const ETH_REGISTRY_ABI = [
  {
    name: "findTokenId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getExpiry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "hasRoles",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "anyId", type: "uint256" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface NameState {
  label: string;
  tokenId: bigint;
  owner: Address;
  expiry: bigint;
  expiryDate: string;
}

export async function getNameState(label: string): Promise<NameState> {
  const tokenId = await client.readContract({
    address: ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: "findTokenId",
    args: [label],
  });

  const [owner, expiry] = await Promise.all([
    client.readContract({
      address: ETH_REGISTRY,
      abi: ETH_REGISTRY_ABI,
      functionName: "ownerOf",
      args: [tokenId],
    }),
    client.readContract({
      address: ETH_REGISTRY,
      abi: ETH_REGISTRY_ABI,
      functionName: "getExpiry",
      args: [tokenId],
    }),
  ]);

  return {
    label,
    tokenId,
    owner,
    expiry,
    expiryDate: new Date(Number(expiry) * 1000).toISOString(),
  };
}

export async function hasRole(tokenId: bigint, roleBitmap: bigint, account: Address): Promise<boolean> {
  return client.readContract({
    address: ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: "hasRoles",
    args: [tokenId, roleBitmap, account],
  });
}

/** The ExecutorRegistry deployment - the real payTo-flip primitive, not the ENSv2 registry above. */
export const EXECUTOR_REGISTRY = "0x99ab8c07c0082cbdd0306b30bc52ea15e6db2521" as const;
export const AGENT_ID = "0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255" as const;

export const AGENT_STATUS_LABEL = ["active", "administration", "liquidation", "resolved"] as const;
export type AgentStatus = (typeof AGENT_STATUS_LABEL)[number];

export const EXECUTOR_REGISTRY_ABI = [
  { type: "error", name: "NotOwner", inputs: [] },
  { type: "error", name: "NotHeartbeatSigner", inputs: [] },
  { type: "error", name: "NotTrustee", inputs: [] },
  { type: "error", name: "NotRecoveryAuthority", inputs: [] },
  { type: "error", name: "PlanIsLocked", inputs: [] },
  { type: "error", name: "AgentNotFound", inputs: [] },
  { type: "error", name: "TooEarly", inputs: [] },
  { type: "error", name: "WrongStatus", inputs: [{ name: "current", type: "uint8" }] },
  {
    name: "getStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "plans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "heartbeatSigner", type: "address" },
      { name: "trustee", type: "address" },
      { name: "recoveryAuthority", type: "address" },
      { name: "treasury", type: "address" },
      { name: "estate", type: "address" },
      { name: "heartbeatInterval", type: "uint64" },
      { name: "gracePeriod", type: "uint64" },
      { name: "lastHeartbeat", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "planLocked", type: "bool" },
    ],
  },
  {
    name: "restoreActive",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "enterAdministration",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "registerAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "heartbeatSigner", type: "address" },
      { name: "trustee", type: "address" },
      { name: "recoveryAuthority", type: "address" },
      { name: "treasury", type: "address" },
      { name: "estate", type: "address" },
      { name: "heartbeatInterval", type: "uint64" },
      { name: "gracePeriod", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "lockPlan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "getPaymentDestination",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "heartbeat",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "treasury", type: "address", indexed: false },
      { name: "estate", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlanLocked",
    inputs: [{ name: "agentId", type: "bytes32", indexed: true }],
  },
  {
    type: "event",
    name: "Heartbeat",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaymentDestinationChanged",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "destination", type: "address", indexed: false },
      { name: "status", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StatusChanged",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "status", type: "uint8", indexed: false },
    ],
  },
] as const;

/** Block ExecutorRegistry was deployed at on Sepolia - found by bisecting
 * cast code against the address, since the deploy tx wasn't recorded. */
export const EXECUTOR_REGISTRY_DEPLOY_BLOCK = 11661800n;

/** publicnode caps eth_getLogs at 50,000 blocks per request, so this is the
 * size of one *chunk*, not the size of the history we are willing to show.
 *
 * An earlier version used it as a sliding window ending at the chain head. That
 * meant the deploy block fell out of range roughly 45,000 blocks (~6 days on
 * Sepolia) after deployment, and from then on the history panel would render
 * empty with no error - the worst possible failure for a panel labelled `live`.
 * The scan now always starts at the deploy block and walks forward in chunks,
 * so this number can only change how many requests are made, never which events
 * are found. */
export const MAX_LOG_RANGE = 45000n;

/** topic0 of every event ExecutorRegistry emits. Passing these as the first
 * topic slot (an OR-match) plus the agentId as the second means the RPC does
 * the filtering, instead of us downloading every agent's logs and filtering in
 * JS. Every event on this contract has `agentId` as its only indexed
 * parameter, which is what makes the single combined query possible. */
const EXECUTOR_EVENT_TOPICS: Hex[] = EXECUTOR_REGISTRY_ABI.filter(
  (item): item is Extract<(typeof EXECUTOR_REGISTRY_ABI)[number], { type: "event" }> =>
    item.type === "event",
).map((event) => toEventSelector(event));

export interface AgentEvent {
  name: string;
  blockNumber: bigint;
  transactionHash: Hex;
  timestamp: number;
  args: Record<string, unknown>;
}

/**
 * Reads this agent's on-chain history.
 *
 * Throws on RPC failure rather than returning `[]` - callers must render the
 * difference, because "the RPC is down" and "this agent has no history" look
 * identical otherwise and the panel is labelled `live`.
 */
export async function getAgentEvents(agentId: Hex = AGENT_ID): Promise<AgentEvent[]> {
  const latest = await client.getBlockNumber();

  // Always anchored at the deploy block - no event this contract has ever
  // emitted can fall outside the scan. Chunked only to respect the RPC's
  // per-request block-range cap.
  const rawLogs: unknown[] = [];
  for (let from = EXECUTOR_REGISTRY_DEPLOY_BLOCK; from <= latest; from += MAX_LOG_RANGE) {
    const to = from + MAX_LOG_RANGE - 1n;
    const chunk = await client.request({
      method: "eth_getLogs",
      params: [
        {
          address: EXECUTOR_REGISTRY,
          fromBlock: numberToHex(from),
          toBlock: numberToHex(to > latest ? latest : to),
          topics: [EXECUTOR_EVENT_TOPICS, agentId],
        },
      ],
    });
    rawLogs.push(...(chunk as unknown[]));
  }

  const logs = parseEventLogs({
    abi: EXECUTOR_REGISTRY_ABI,
    logs: rawLogs as unknown as Log[],
  });

  const uniqueBlocks = Array.from(new Set(logs.map((l) => l.blockNumber)));
  const timestamps = new Map<bigint, number>(
    await Promise.all(
      uniqueBlocks.map(
        async (bn) => [bn, Number((await client.getBlock({ blockNumber: bn })).timestamp)] as const,
      ),
    ),
  );

  return logs
    .map((log) => ({
      name: log.eventName as string,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
      timestamp: timestamps.get(log.blockNumber) ?? 0,
      args: log.args as Record<string, unknown>,
    }))
    .sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0));
}

export async function getAgentStatus(agentId: Hex = AGENT_ID): Promise<AgentStatus> {
  const status = await client.readContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName: "getStatus",
    args: [agentId],
  });
  return AGENT_STATUS_LABEL[status];
}

export interface AgentPlan {
  owner: Address;
  heartbeatSigner: Address;
  treasury: Address;
  estate: Address;
  status: AgentStatus;
  heartbeatInterval: number;
  gracePeriod: number;
  lastHeartbeat: number;
  eligibleAt: number;
  planLocked: boolean;
}

export async function getAgentPlan(agentId: Hex = AGENT_ID): Promise<AgentPlan> {
  const plan = await client.readContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName: "plans",
    args: [agentId],
  });
  const heartbeatInterval = Number(plan[6]);
  const gracePeriod = Number(plan[7]);
  const lastHeartbeat = Number(plan[8]);
  return {
    owner: plan[0],
    heartbeatSigner: plan[1],
    treasury: plan[4],
    estate: plan[5],
    status: AGENT_STATUS_LABEL[plan[9]],
    heartbeatInterval,
    gracePeriod,
    lastHeartbeat,
    eligibleAt: lastHeartbeat + heartbeatInterval + gracePeriod,
    planLocked: plan[10],
  };
}

export async function getPaymentDestination(agentId: Hex = AGENT_ID): Promise<Address> {
  return client.readContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName: "getPaymentDestination",
    args: [agentId],
  });
}

export { client as sepoliaPublicClient };

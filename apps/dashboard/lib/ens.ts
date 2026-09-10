import { createPublicClient, http, type Address, type Hex } from "viem";
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
export const EXECUTOR_REGISTRY = "0x2946b46c2eb5ec532093877223ef043b13729e39" as const;
/** The agent `executor-hackathon-demo.eth` resolves to, and the one this
 * dashboard treats as "the live agent". Four distinct role keys - owner,
 * heartbeat signer, trustee and recovery authority are four different
 * addresses - which the agent this replaced did not have. */
export const AGENT_ID = "0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37" as const;

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
/** The shape the dashboard renders history in. Now produced by `lib/subgraph.ts`.
 *
 * The chunked `eth_getLogs` reader that used to fill this lived here and has
 * been deleted rather than left behind a flag. It paged backwards from the
 * chain head in 45,000-block windows because that is the public RPC's cap, and
 * an earlier revision of it let the registry's deploy block age out of range -
 * rendering an empty history, with no error, on a panel labelled `live`. Keeping
 * it as an unreferenced fallback would preserve exactly that failure for
 * whoever wired it back up. Git history has it.
 */
export interface AgentEvent {
  name: string;
  blockNumber: bigint;
  transactionHash: Hex;
  timestamp: number;
  args: Record<string, unknown>;
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

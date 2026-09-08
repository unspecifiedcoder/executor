import { createPublicClient, http, type Address } from "viem";
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
] as const;

export async function getAgentStatus(): Promise<AgentStatus> {
  const status = await client.readContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName: "getStatus",
    args: [AGENT_ID],
  });
  return AGENT_STATUS_LABEL[status];
}

export interface AgentPlan {
  status: AgentStatus;
  heartbeatInterval: number;
  gracePeriod: number;
  lastHeartbeat: number;
  eligibleAt: number;
  planLocked: boolean;
}

export async function getAgentPlan(): Promise<AgentPlan> {
  const plan = await client.readContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName: "plans",
    args: [AGENT_ID],
  });
  const heartbeatInterval = Number(plan[6]);
  const gracePeriod = Number(plan[7]);
  const lastHeartbeat = Number(plan[8]);
  return {
    status: AGENT_STATUS_LABEL[plan[9]],
    heartbeatInterval,
    gracePeriod,
    lastHeartbeat,
    eligibleAt: lastHeartbeat + heartbeatInterval + gracePeriod,
    planLocked: plan[10],
  };
}

export { client as sepoliaPublicClient };

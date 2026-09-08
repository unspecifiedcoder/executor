import "server-only";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { AGENT_ID, EXECUTOR_REGISTRY, EXECUTOR_REGISTRY_ABI, sepoliaPublicClient } from "./ens";

/**
 * Real, server-held key driving the shared public demo agent. This is
 * deliberately a single, low-value testnet-only wallet (never mainnet, never
 * holds more than a few cents of Sepolia ETH) - the risk model here is "the
 * demo's gas runs dry," not "funds at risk." A single in-memory lock keeps
 * concurrent clicks (this is one shared agent, visible to every viewer) from
 * racing each other into duplicate transactions.
 */

let inFlight = false;

const MIN_BALANCE_WEI = 1_000_000_000_000_000n; // 0.001 ETH - enough for a few more actions

function getWalletClient() {
  const key = process.env.OPERATOR_PRIVATE_KEY;
  if (!key) throw new Error("OPERATOR_PRIVATE_KEY not configured on the server");
  const account = privateKeyToAccount(key as Hex);
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
  });
}

export class ActionInFlightError extends Error {
  constructor() {
    super("Another visitor's action is already in flight on this shared demo agent");
  }
}

export class LowBalanceError extends Error {
  constructor() {
    super("Operator wallet balance too low to safely submit another transaction - needs a top-up");
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight) throw new ActionInFlightError();
  inFlight = true;
  try {
    const balance = await sepoliaPublicClient.getBalance({
      address: getWalletClient().account.address,
    });
    if (balance < MIN_BALANCE_WEI) throw new LowBalanceError();
    return await fn();
  } finally {
    inFlight = false;
  }
}

export async function submitRestoreActive(): Promise<Hex> {
  return withLock(async () => {
    const wallet = getWalletClient();
    return wallet.writeContract({
      address: EXECUTOR_REGISTRY,
      abi: EXECUTOR_REGISTRY_ABI,
      functionName: "restoreActive",
      args: [AGENT_ID],
    });
  });
}

export async function submitEnterAdministration(): Promise<Hex> {
  return withLock(async () => {
    const wallet = getWalletClient();
    return wallet.writeContract({
      address: EXECUTOR_REGISTRY,
      abi: EXECUTOR_REGISTRY_ABI,
      functionName: "enterAdministration",
      args: [AGENT_ID],
    });
  });
}

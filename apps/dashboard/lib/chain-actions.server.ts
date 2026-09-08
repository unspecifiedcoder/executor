import "server-only";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  AGENT_ID,
  EXECUTOR_REGISTRY,
  EXECUTOR_REGISTRY_ABI,
  sepoliaPublicClient,
  getAgentStatus,
  type AgentStatus,
} from "./ens";

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

/**
 * Not a failure: the plan was already in the requested state before this
 * call even reached the chain. This is the expected outcome of a stale
 * countdown firing twice (a second browser tab, a page reload mid-wait) -
 * the contract's own WrongStatus revert is what proves it, and the caller
 * should treat that as "someone else already made this true," not an error.
 */
export class AlreadyInStateError extends Error {
  constructor(public readonly status: AgentStatus) {
    super(`Plan is already ${status}`);
  }
}

export class TransactionRevertedError extends Error {
  constructor(public readonly txHash: Hex) {
    super(`Transaction ${txHash} reverted on-chain`);
  }
}

/**
 * Holds the lock for the transaction's full lifetime, not just submission.
 * writeContract() resolves as soon as the tx is broadcast, long before it's
 * mined - releasing the lock there let two rapid calls land in the same
 * Sepolia block, with the second one genuinely reverting (real gas spent on
 * a failing tx, confirmed via receipt: both eb50a7f2... and d358167... were
 * mined in block 11662543, only the first succeeded). Waiting for the
 * receipt here, inside the lock, is what actually serializes these calls
 * against real chain state instead of just against each other's timing.
 */
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

async function submitAndConfirm(functionName: "restoreActive" | "enterAdministration"): Promise<Hex> {
  const wallet = getWalletClient();
  const txHash = await wallet.writeContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName,
    args: [AGENT_ID],
  });
  const receipt = await sepoliaPublicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new TransactionRevertedError(txHash);
  return txHash;
}

export async function submitRestoreActive(): Promise<Hex> {
  return withLock(async () => {
    const status = await getAgentStatus();
    if (status !== "administration") throw new AlreadyInStateError(status);
    return submitAndConfirm("restoreActive");
  });
}

export async function submitEnterAdministration(): Promise<Hex> {
  return withLock(async () => {
    const status = await getAgentStatus();
    if (status !== "active") throw new AlreadyInStateError(status);
    return submitAndConfirm("enterAdministration");
  });
}

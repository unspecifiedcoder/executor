import { createWalletClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

export interface HeartbeatConfig {
  receiverAddress: Address;
  agentPrivateKey: `0x${string}`;
  rpcUrl: string;
  intervalMs: number;
}

const RECEIVER_PING_ABI = [
  { name: "ping", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

/** Starts sending signed `ping()` calls to Receiver on an interval. Returns a stop function. */
export function startHeartbeat(config: HeartbeatConfig): () => void {
  const account = privateKeyToAccount(config.agentPrivateKey);
  const client = createWalletClient({ account, chain: sepolia, transport: http(config.rpcUrl) });

  const send = async () => {
    try {
      const hash = await client.writeContract({
        address: config.receiverAddress,
        abi: RECEIVER_PING_ABI,
        functionName: "ping",
      });
      console.log(`[heartbeat] ping sent: ${hash}`);
    } catch (err) {
      console.error("[heartbeat] ping failed", err);
    }
  };

  const timer = setInterval(send, config.intervalMs);
  void send();

  return () => clearInterval(timer);
}

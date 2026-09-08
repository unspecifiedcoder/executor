import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { DynamicPayTo } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";

/**
 * The real gateway: payTo is never a fixed address. Every request re-reads
 * ExecutorRegistry.getPaymentDestination() on Sepolia and pays out to whatever
 * that returns right now - treasury while Active, estate once Administration
 * has been declared. Same endpoint, same identity, different money destination.
 */

const REGISTRY_ADDRESS = "0x99ab8c07c0082cbdd0306b30bc52ea15e6db2521" as const;
const AGENT_ID = "0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255" as const;

// Known Sepolia EVM address -> Hedera account ID mapping for this demo's
// treasury/estate accounts (both created via the Hedera portal faucet and
// confirmed via mirror node before this gateway ever runs).
const HEDERA_ACCOUNT_BY_EVM_ADDRESS: Record<string, string> = {
  "0x7ea7f6e97e24f1ad03db0bd544a0aef4a1f07330": "0.0.10423643", // treasury
  "0xde3207f493fe4600deec424e0875ec943d712337": "0.0.10423647", // estate
};

const REGISTRY_ABI = [
  {
    name: "getPaymentDestination",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

async function resolveHederaPayTo(): Promise<string> {
  const destination = (await sepoliaClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getPaymentDestination",
    args: [AGENT_ID],
  })) as Address;

  const hederaAccount = HEDERA_ACCOUNT_BY_EVM_ADDRESS[destination.toLowerCase()];
  if (!hederaAccount) {
    throw new Error(`No known Hedera account for Sepolia destination ${destination}`);
  }
  console.log(`[gateway] getPaymentDestination() -> ${destination} -> ${hederaAccount}`);
  return hederaAccount;
}

const dynamicPayTo: DynamicPayTo = async () => resolveHederaPayTo();

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://api.testnet.blocky402.com",
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "hedera:*",
  new ExactHederaScheme({
    defaultAssets: {
      "hedera:testnet": { asset: "0.0.0", decimals: 8 }, // native HBAR, tinybar units
    },
  }),
);

app.use(
  paymentMiddleware(
    {
      "GET /research": {
        accepts: {
          scheme: "exact",
          network: "hedera:testnet",
          payTo: dynamicPayTo,
          // Native HBAR (asset 0.0.0) has no $-price auto-conversion oracle, so the
          // amount is given directly in tinybars: 1,000,000 tinybars = 0.01 HBAR.
          price: { asset: "0.0.0", amount: "1000000" },
        },
        description: "Atlas research service - payTo resolves from ExecutorRegistry on every request",
      },
    },
    resourceServer,
  ),
);

app.get("/research", (_req, res) => {
  res.json({
    result: "Executor: economic continuity for autonomous agents.",
    agent: "executor-hackathon-demo.eth",
    servedAt: new Date().toISOString(),
  });
});

const PORT = 3200;
app.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}, paying out per ExecutorRegistry state`);
});

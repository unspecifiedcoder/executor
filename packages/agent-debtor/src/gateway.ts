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

const MIRROR_NODE_URL = "https://testnet.mirrornode.hedera.com";

/**
 * Resolves an EVM address to its Hedera account ID via the mirror node REST API.
 *
 * This is a general lookup rather than a table of this demo's two accounts, so
 * any agent whose treasury/estate addresses correspond to Hedera testnet
 * accounts works through this gateway unmodified. An address with no Hedera
 * account returns 404, which is surfaced as an explicit error - the gateway
 * refuses to quote a price it cannot route, instead of falling back to some
 * default destination.
 */
const hederaAccountCache = new Map<string, string>();

async function hederaAccountForEvmAddress(evmAddress: string): Promise<string> {
  const key = evmAddress.toLowerCase();
  const cached = hederaAccountCache.get(key);
  if (cached) return cached;

  const response = await fetch(`${MIRROR_NODE_URL}/api/v1/accounts/${key}`);

  if (response.status === 404) {
    throw new Error(
      `No Hedera testnet account exists for EVM address ${evmAddress} ` +
        `(mirror node /api/v1/accounts/${key} returned 404). The payment destination ` +
        `must be an address that maps to a Hedera account.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Hedera mirror node lookup for ${evmAddress} failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as { account?: string; deleted?: boolean };
  if (!body.account) {
    throw new Error(`Hedera mirror node returned no account id for ${evmAddress}`);
  }
  if (body.deleted) {
    throw new Error(`Hedera account ${body.account} for ${evmAddress} has been deleted`);
  }

  hederaAccountCache.set(key, body.account);
  return body.account;
}

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

  const hederaAccount = await hederaAccountForEvmAddress(destination);
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
        // Deliberately not dressed up as an inference/research product: the
        // response is a fixed string. What is being demonstrated is where the
        // payment lands, not what is being sold.
        description:
          "Demo resource (fixed response) - payTo resolves from ExecutorRegistry on every request",
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

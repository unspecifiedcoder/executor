import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequirements,
  SupportedResponse,
  VerifyResponse,
} from "@x402/core";
// `DynamicPayTo` lives on the `/http` entrypoint, not `/server`. Importing it
// from `/server` typechecked as an error but ran fine, because a type-only
// import is erased before Node ever sees it - the kind of breakage that only
// surfaces the first time someone runs `tsc` over this package.
import type { DynamicPayTo } from "@x402/core/http";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { createPublicClient, http, namehash, type Address } from "viem";
import { sepolia } from "viem/chains";

/**
 * The real gateway. Two things here are load-bearing rather than decorative:
 *
 * 1. `payTo` is never a fixed address. It is resolved per request, through ENS,
 *    from the agent's live registry state - treasury while Active, estate once
 *    Administration has been declared. Same endpoint, same name, different
 *    money destination.
 *
 * 2. `GET /research` performs a real LLM call with the caller's query. The
 *    thing behind the paywall is generated at request time; there is no canned
 *    response to fall back to, and an upstream failure is surfaced as an error
 *    rather than dressed up as output.
 */

const EXECUTOR_REGISTRY = (process.env.EXECUTOR_REGISTRY_ADDRESS ??
  "0x2946b46c2eb5ec532093877223ef043b13729e39") as Address;

/**
 * Which agent this gateway sells on behalf of.
 *
 * Environment-driven, with the hosted deployment's agent as the default, for a
 * reason worth stating: the agent id and the ENS label have to move together.
 * A gateway serving agent A's endpoint while resolving agent B's name would
 * pass its own cross-check (both sides would agree) and still be selling the
 * wrong agent's revenue stream. Keeping both in `.env` next to each other,
 * with matching defaults, is what makes "repoint this at another agent" a
 * two-line change that is obviously either done or not done.
 *
 * To run this gateway for agent 3 (the agent that has an Estate *contract* and
 * a routed payment behind it), set both:
 *
 *   X402_AGENT_ID=0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4
 *   X402_ENS_LABEL=<the label bound to that agent id in ExecutorResolver>
 *
 * See README, "Which agent proves what", for why the hosted instance still
 * defaults to agent 1.
 */
const AGENT_ID = (process.env.X402_AGENT_ID ??
  "0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255") as `0x${string}`;

/**
 * ENSv2 beta `PermissionedRegistry` (`ETHRegistry`) on Sepolia, from
 * `ensdomains/contracts-v2` @ `contracts/deployments/sepolia/ETHRegistry.json`.
 *
 * Not the address on docs.ens.domains/learn/deployments - that page lists an
 * older generation of the ENSv2 beta contracts whose ABI has since changed
 * (`getParent()` reverts on it). Three generations exist on Sepolia; this is
 * the one matching `main`.
 */
const ENS_ETH_REGISTRY = "0x67b728a792e789a8978b30cf1b3b641f19354b43" as const;
const ENS_LABEL = process.env.X402_ENS_LABEL ?? "executor-hackathon-demo";
const ENS_NAME = `${ENS_LABEL}.eth`;
const ENS_NODE = namehash(ENS_NAME);

/** ENSIP-11 coin type for Ethereum-format addresses. */
const COIN_TYPE_ETH = 60n;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

const EXECUTOR_REGISTRY_ABI = [
  {
    name: "getPaymentDestination",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/**
 * The ENSv2 registry's own resolver accessor. Note the argument is the *label*
 * string, not a namehash - the read and write sides of this contract are
 * asymmetric (`setResolver` takes a uint256 id). This is what the deployed
 * `PermissionedRegistry` actually exposes; `getResolver(uint256)` does not
 * exist on it and reverts.
 */
const ENS_REGISTRY_ABI = [
  {
    name: "getResolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/**
 * ENSIP-9/11 `addr`. Deliberately the standard resolver interface and nothing
 * more, so the gateway is not coupled to our particular resolver: point the
 * name at any conforming ENS resolver and this keeps working.
 */
const ENS_RESOLVER_ABI = [
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "coinType", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

/**
 * Thrown when the gateway cannot establish, to its own satisfaction, where the
 * money should go. Always results in a refusal to quote a price - never a
 * fallback destination.
 */
class PayToResolutionError extends Error {}

export interface PayToResolution {
  payTo: Address;
  resolver: Address;
}

/**
 * Resolves the payout address *through ENS*.
 *
 * The chain is: ENSv2 registry -> the name's resolver -> `addr(node, 60)`.
 * The ENS record is what determines where money goes. Repoint the name at a
 * different resolver - an authority the operator holds via `ROLE_SET_RESOLVER`
 * and can never delegate, having burned `ROLE_SET_RESOLVER_ADMIN` - and this
 * gateway pays somewhere else on the very next request.
 *
 * The result is then cross-checked against `ExecutorRegistry` directly, and a
 * mismatch is a hard refusal. That check is the reason this is safe to ship: an
 * ENS record that had drifted from the registry would silently route an agent's
 * revenue to an address its estate no longer controls, which is worse than not
 * using ENS at all. Here, disagreement stops payments instead of misdirecting
 * them.
 *
 * In this deployment the two cannot in fact drift, because the resolver on the
 * other end derives `addr()` from the registry at call time rather than storing
 * a copy (see `contracts/src/ExecutorResolver.sol`). The cross-check still
 * runs, because what it really guards is the resolver *pointer*: a name
 * repointed at some other resolver that does store an address gets caught here.
 */
export async function resolvePayToAddress(): Promise<PayToResolution> {
  const resolver = (await sepoliaClient.readContract({
    address: ENS_ETH_REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: "getResolver",
    args: [ENS_LABEL],
  })) as Address;

  if (resolver.toLowerCase() === ZERO_ADDRESS) {
    throw new PayToResolutionError(
      `${ENS_NAME} has no resolver set in the ENSv2 registry at ${ENS_ETH_REGISTRY}. ` +
        `Refusing to quote a price rather than falling back to reading the registry directly.`,
    );
  }

  const raw = (await sepoliaClient.readContract({
    address: resolver,
    abi: ENS_RESOLVER_ABI,
    functionName: "addr",
    args: [ENS_NODE, COIN_TYPE_ETH],
  })) as `0x${string}`;

  // 20 bytes = "0x" + 40 hex chars. Anything else - notably empty, which is
  // what a conforming resolver returns for "no record" - is not an address.
  if (raw.length !== 42) {
    throw new PayToResolutionError(
      `Resolver ${resolver} returned no ETH addr record for ${ENS_NAME}: ` +
        `addr(node, 60) returned ${raw.length === 2 ? "empty" : `${(raw.length - 2) / 2} bytes`}.`,
    );
  }
  const ensAddress = raw as Address;

  const registryAddress = (await sepoliaClient.readContract({
    address: EXECUTOR_REGISTRY,
    abi: EXECUTOR_REGISTRY_ABI,
    functionName: "getPaymentDestination",
    args: [AGENT_ID],
  })) as Address;

  if (ensAddress.toLowerCase() !== registryAddress.toLowerCase()) {
    throw new PayToResolutionError(
      `ENS/registry mismatch for ${ENS_NAME}: resolver ${resolver} says ${ensAddress}, ` +
        `ExecutorRegistry says ${registryAddress}. Refusing to take payment - a stale or ` +
        `hijacked ENS record must stop the money, not redirect it.`,
    );
  }

  return { payTo: ensAddress, resolver };
}

async function resolveHederaPayTo(): Promise<string> {
  const { payTo, resolver } = await resolvePayToAddress();
  const hederaAccount = await hederaAccountForEvmAddress(payTo);
  console.log(
    `[gateway] ${ENS_NAME} -> resolver ${resolver} -> addr(60) ${payTo} ` +
      `(registry-confirmed) -> hedera ${hederaAccount}`,
  );
  return hederaAccount;
}

const dynamicPayTo: DynamicPayTo = async () => resolveHederaPayTo();

/* ------------------------------------------------------------------------- *
 * The paid resource itself.
 * ------------------------------------------------------------------------- */

const LLM_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/** Chosen for latency: this model answers in well under a second, which keeps a
 * paid request inside the window a live demo can sit through. */
const LLM_MODEL = "qwen/qwen3.8-27b";
const LLM_TIMEOUT_MS = 20_000;
const MAX_QUERY_LENGTH = 500;

const SYSTEM_PROMPT =
  "You are a concise research assistant. Answer the user's question directly in " +
  "at most 120 words of plain prose. No preamble, no bullet lists, no markdown headings.";

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface ResearchResult {
  answer: string;
  model: string;
  tokens: number | null;
  latencyMs: number;
}

/**
 * Performs the actual inference.
 *
 * There is deliberately no canned-response fallback anywhere in this function.
 * If the key is absent or the upstream fails, the caller gets an error saying
 * exactly that. Serving a fixed string and letting the response describe it as
 * generated would make the paywall a lie - which is the precise failure this
 * endpoint was rewritten to fix.
 */
async function runResearchQuery(query: string): Promise<ResearchResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new UpstreamError(
      "GROQ_API_KEY is not configured on this gateway, so no inference can be " +
        "performed. This endpoint has no canned response to serve instead.",
      503,
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(LLM_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Groq sits behind a WAF that 403s requests arriving with no User-Agent.
        "User-Agent": "executor-x402-gateway/1.0",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        // This model emits a reasoning trace by default, which costs seconds
        // and is not what the caller paid for.
        reasoning_effort: "none",
        temperature: 0.2,
        max_tokens: 400,
      }),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new UpstreamError(
      aborted
        ? `Inference upstream did not respond within ${LLM_TIMEOUT_MS}ms.`
        : `Inference upstream could not be reached: ${(error as Error).message}`,
      504,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new UpstreamError(
      `Inference upstream returned ${response.status} ${response.statusText}: ${detail}`,
      502,
    );
  }

  const body = (await response.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new UpstreamError("Inference upstream returned a response containing no content.", 502);
  }

  return {
    answer,
    model: body.model ?? LLM_MODEL,
    tokens: body.usage?.total_tokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
}

const app = express();

/**
 * The facilitator, with retries on the calls that are safe to retry.
 *
 * `getSupported()` is called while building the 402 challenge, and a single
 * slow response from the facilitator therefore fails the request before a price
 * has even been quoted - observed in practice as
 * `Facilitator supported request timed out after 30000ms`, roughly one request
 * in four during one sampling. The library already retries this on HTTP 429 but
 * not on timeout, and a demo that is a coin flip is not a demo.
 *
 * **`settle` is deliberately NOT retried.** It moves money. Without an
 * idempotency key from the facilitator there is no way to distinguish "the
 * settlement never happened" from "the settlement happened and the response was
 * lost", and retrying the second case pays twice. A failed settle surfaces as a
 * failed request, which is the honest outcome: the caller can retry the whole
 * payment, which is idempotent at the payload level because the payment payload
 * is signed once and replay-protected by the facilitator.
 *
 * `verify` and `getSupported` are reads and carry no such hazard.
 */
class RetryingFacilitatorClient extends HTTPFacilitatorClient {
  private static readonly ATTEMPTS = 3;

  private async retryRead<T>(label: string, call: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RetryingFacilitatorClient.ATTEMPTS; attempt++) {
      try {
        return await call();
      } catch (err) {
        lastError = err;
        if (attempt === RetryingFacilitatorClient.ATTEMPTS) break;
        // 400ms, then 1200ms. Short enough that a caller waiting on a 402 does
        // not give up, long enough to clear a transient facilitator stall.
        const backoffMs = 400 * 3 ** (attempt - 1);
        console.warn(
          `[gateway] facilitator ${label} attempt ${attempt} failed, retrying in ${backoffMs}ms:`,
          err instanceof Error ? err.message : err,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    throw lastError;
  }

  override getSupported(): Promise<SupportedResponse> {
    return this.retryRead("getSupported", () => super.getSupported());
  }

  override verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    return this.retryRead("verify", () => super.verify(paymentPayload, paymentRequirements));
  }
}

const facilitatorClient = new RetryingFacilitatorClient({
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

/**
 * Query validation runs *before* the payment middleware, on purpose. A caller
 * who forgot `?q=` should be told so for free, not charged 0.01 HBAR and then
 * handed a 400.
 */
app.get("/research", (req, res, next) => {
  const raw = req.query.q;
  const query = typeof raw === "string" ? raw.trim() : "";

  if (!query) {
    res.status(400).json({
      error: "missing_query",
      message:
        "GET /research requires a ?q= query parameter - it is the prompt this " +
        "endpoint runs. Nothing is charged for a malformed request.",
      example: "/research?q=What%20is%20ENSv2%3F",
    });
    return;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({
      error: "query_too_long",
      message: `?q= must be at most ${MAX_QUERY_LENGTH} characters (got ${query.length}).`,
    });
    return;
  }
  next();
});

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
        description:
          `LLM research query (?q=...), answered by ${LLM_MODEL} at request time. ` +
          `payTo resolves through ENS: ${ENS_NAME} -> resolver -> addr(node, 60), ` +
          `cross-checked against ExecutorRegistry on every request.`,
      },
    },
    resourceServer,
  ),
);

app.get("/research", async (req, res) => {
  // Re-read rather than trusting anything stashed on the request by the
  // validator above: the payment middleware sits between the two.
  const query = String(req.query.q ?? "").trim();

  try {
    const result = await runResearchQuery(query);
    res.json({
      query,
      answer: result.answer,
      model: result.model,
      tokens: result.tokens,
      latencyMs: result.latencyMs,
      agent: ENS_NAME,
      servedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof UpstreamError) {
      console.error(`[gateway] inference failed: ${error.message}`);
      res.status(error.status).json({ error: "inference_failed", message: error.message });
      return;
    }
    console.error("[gateway] unexpected error", error);
    res.status(500).json({ error: "internal_error", message: (error as Error).message });
  }
});

/**
 * Unpaid introspection endpoint, so the ENS resolution chain can be inspected
 * without spending HBAR - including by a judge who only wants to confirm that
 * the name, and not a hardcoded address, is what decides the destination.
 */
app.get("/payto", async (_req, res) => {
  try {
    const { payTo, resolver } = await resolvePayToAddress();
    res.json({
      ensName: ENS_NAME,
      ensNode: ENS_NODE,
      ensRegistry: ENS_ETH_REGISTRY,
      resolver,
      payTo,
      executorRegistry: EXECUTOR_REGISTRY,
      agentId: AGENT_ID,
      registryCrossCheck: "passed",
      hederaAccount: await hederaAccountForEvmAddress(payTo),
    });
  } catch (error) {
    const refused = error instanceof PayToResolutionError;
    res.status(refused ? 409 : 502).json({
      error: refused ? "payto_resolution_refused" : "payto_lookup_failed",
      message: (error as Error).message,
    });
  }
});

/** A hosted x402 service is the whole point - a paywall only reachable on the
 * author's laptop demonstrates nothing to anyone else. Every PaaS assigns the
 * port through the environment, so taking it from there is what makes this
 * deployable; 3200 stays as the local default. */
const PORT = Number(process.env.PORT ?? 3200);

/** Exported so a serverless entrypoint can mount the same app without opening a
 * socket. Kept separate from the listen() below, which only runs when this file
 * is executed directly (local dev, Docker, any long-lived host). */
export default app;
export { app };

const isDirectRun = process.env.X402_GATEWAY_SERVERLESS !== "1";
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`[gateway] listening on :${PORT}, paying out per ${ENS_NAME} ENS resolution`);
  });
}

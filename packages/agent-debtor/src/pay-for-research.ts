import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { PrivateKey } from "@hiero-ledger/sdk";

/**
 * Makes one real paid request against the gateway. Run this twice in the
 * demo: once while ExecutorRegistry says Active (money lands in treasury),
 * once after enterAdministration() has been called (money lands in estate) -
 * same command, same endpoint, different real on-chain destination.
 */

/** Points at the hosted gateway when GATEWAY_URL is set, so the same script
 * proves the flip against a service a judge can reach rather than one only
 * running on this laptop. Falls back to local for development. */
const GATEWAY_BASE = process.env.GATEWAY_URL ?? "http://localhost:3200/research";

/** The prompt being bought. `/research` runs this through an LLM at request
 * time, so a different `RESEARCH_QUERY` buys a different, genuinely generated
 * answer - which is the point of paying at all. Overridable so the demo can be
 * run twice with different questions and show the answers differ. */
const RESEARCH_QUERY =
  process.env.RESEARCH_QUERY ?? "What is ENSv2 and how does it differ from ENSv1?";

/** The query must be on the URL for both the 402 probe and the paid retry: the
 * x402 resource identity includes the full URL, so probing one URL and paying
 * against another would not settle.
 *
 * A `?q=` already present on GATEWAY_URL wins. Appending unconditionally is
 * what the obvious template-string version does, and it produces a URL with two
 * query strings glued together - the gateway then answers both questions at
 * once, which looks like an LLM hallucination when it is really this client
 * asking for it. Pasting a full URL with a question on it is the natural thing
 * to do, so it has to be the thing that works. */
function buildGatewayUrl(): string {
  const url = new URL(GATEWAY_BASE);
  if (!url.searchParams.get("q")) {
    url.searchParams.set("q", RESEARCH_QUERY);
  }
  return url.toString();
}

const GATEWAY_URL = buildGatewayUrl();
const CLIENT_HEDERA_ACCOUNT_ID = "0.0.10423620";

async function main(): Promise<void> {
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  if (!privateKey) throw new Error("HEDERA_PRIVATE_KEY not set");

  const signer = createClientHederaSigner(
    CLIENT_HEDERA_ACCOUNT_ID,
    PrivateKey.fromStringECDSA(privateKey),
    { network: "hedera:testnet" },
  );

  // Native HBAR isn't in the SDK's default-asset allowlist, so this demo wallet
  // (funded testnet HBAR only, no spend risk) disables client-side spend controls
  // rather than declaring an allowedAssets entry for one native-asset test payment.
  const coreClient = x402Client.fromConfig({
    schemes: [{ network: "hedera:*", client: new ExactHederaScheme(signer) }],
    spendControls: false,
  });
  const client = new x402HTTPClient(coreClient);

  console.log(`[client] GET ${GATEWAY_URL}`);
  // Read back off the URL rather than printing RESEARCH_QUERY: when the
  // caller supplied their own ?q=, the constant is not what gets bought.
  console.log(`[client] query: ${new URL(GATEWAY_URL).searchParams.get("q")}`);
  const response = await fetch(GATEWAY_URL);

  if (response.status !== 402) {
    console.log(`[client] unexpected status ${response.status} (route may already be free)`);
    console.log(await response.json());
    return;
  }

  console.log("[client] got 402 Payment Required, building payment...");
  const paymentRequired = client.getPaymentRequiredResponse(
    (name) => response.headers.get(name),
    await response.json(),
  );

  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  console.log("[client] payment signed, retrying with X-PAYMENT header...");

  const paidResponse = await fetch(GATEWAY_URL, {
    headers: client.encodePaymentSignatureHeader(paymentPayload),
  });

  if (!paidResponse.ok) {
    console.error(`[client] paid request failed: ${paidResponse.status}`);
    console.error(await paidResponse.text());
    process.exit(1);
  }

  const settlement = client.getPaymentSettleResponse((name) => paidResponse.headers.get(name));
  console.log("[client] settlement:", settlement);
  console.log("[client] response body:", await paidResponse.json());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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

const GATEWAY_URL = "http://localhost:3200/research";
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

import { NextResponse } from "next/server";
import { getAgentPlan } from "../../../lib/ens";

/**
 * The payment rail, read live, in one response.
 *
 * Answers the judge question the replay animation cannot: "that is your drawing
 * of the flip - where is the flip itself?" Every field below is read from a
 * system this project does not own:
 *
 *   - `/payto` is the hosted gateway resolving the destination through ENS and
 *     cross-checking it against ExecutorRegistry on Sepolia.
 *   - the 402 is a real x402 challenge, served over HTTP, quoting a real price.
 *   - the settlement row comes from Hedera's public mirror node.
 *
 * It is a server route rather than three client fetches because the 402's
 * payment requirements ride in a response header, and a cross-origin reader
 * cannot see a header the origin does not explicitly expose. Reading it here
 * also means the browser never has to talk to three hosts to draw one panel.
 */

const GATEWAY = process.env.GATEWAY_URL ?? "https://executor-gateway.vercel.app";
const MIRROR = "https://testnet.mirrornode.hedera.com";
const PROBE_QUERY = "What is ENSv2?";

/** Hedera quotes native HBAR in tinybars; 1 HBAR = 1e8 tinybars. */
const TINYBARS_PER_HBAR = 100_000_000;

export const revalidate = 30;

type Accept = {
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
};

async function readPayTo() {
  const r = await fetch(`${GATEWAY}/payto`, { next: { revalidate: 30 } });
  if (!r.ok) throw new Error(`payto ${r.status}`);
  return r.json();
}

/**
 * Asks for the resource without paying and reads the challenge back. A 402 is
 * the success case here - any other status means the paywall is not doing its
 * job, and the panel should say so rather than quietly showing stale numbers.
 */
async function readChallenge(): Promise<{ status: number; accept: Accept | null }> {
  const url = `${GATEWAY}/research?q=${encodeURIComponent(PROBE_QUERY)}`;
  const r = await fetch(url, { next: { revalidate: 30 } });
  const header = r.headers.get("payment-required");
  if (!header) return { status: r.status, accept: null };
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    return { status: r.status, accept: decoded?.accepts?.[0] ?? null };
  } catch {
    return { status: r.status, accept: null };
  }
}

/**
 * The most recent credit into whichever account the rail currently points at.
 * Deliberately scoped to that account: after a flip the treasury's history is
 * still there, and showing it would imply money is still arriving somewhere it
 * is not.
 */
async function readLastSettlement(accountId: string) {
  const r = await fetch(
    `${MIRROR}/api/v1/transactions?account.id=${accountId}&limit=25&order=desc&transactiontype=CRYPTOTRANSFER&result=success`,
    { next: { revalidate: 30 } },
  );
  if (!r.ok) return null;
  const body = await r.json();
  for (const tx of body?.transactions ?? []) {
    const credit = (tx.transfers ?? []).find(
      (t: { account: string; amount: number }) => t.account === accountId && t.amount > 0,
    );
    if (!credit) continue;
    return {
      id: tx.transaction_id as string,
      amountHbar: credit.amount / TINYBARS_PER_HBAR,
      consensusAt: Number(tx.consensus_timestamp) * 1000,
    };
  }
  return null;
}

export async function GET() {
  try {
    const payto = await readPayTo();
    const hederaAccount: string | undefined = payto?.hederaAccount;

    // The challenge and the mirror node do not depend on each other, and the
    // panel is worth rendering even if one of them is having a bad minute.
    const [challenge, settlement] = await Promise.all([
      readChallenge().catch(() => ({ status: 0, accept: null })),
      hederaAccount ? readLastSettlement(hederaAccount).catch(() => null) : Promise.resolve(null),
    ]);

    // `/payto` reports where the money goes but not which venue that *is* -
    // the registry is the authority on that. Naming the venue by comparing
    // against the plan means the label cannot drift from the address above it.
    const plan = await getAgentPlan().catch(() => null);
    const payToLower = typeof payto?.payTo === "string" ? payto.payTo.toLowerCase() : null;
    const venue =
      plan && payToLower === plan.treasury.toLowerCase()
        ? "treasury"
        : plan && payToLower === plan.estate.toLowerCase()
          ? "estate"
          : null;

    return NextResponse.json({
      ensName: payto?.ensName ?? null,
      resolver: payto?.resolver ?? null,
      payTo: payto?.payTo ?? null,
      registry: payto?.executorRegistry ?? null,
      crossCheck: payto?.registryCrossCheck ?? null,
      agentId: payto?.agentId ?? null,
      hederaAccount: hederaAccount ?? null,
      venue,
      status: plan?.status ?? null,
      lastHeartbeat: plan?.lastHeartbeat ?? null,
      eligibleAt: plan?.eligibleAt ?? null,
      challenge: {
        status: challenge.status,
        network: challenge.accept?.network ?? null,
        asset: challenge.accept?.asset ?? null,
        amount: challenge.accept?.amount ?? null,
        payTo: challenge.accept?.payTo ?? null,
        /** The whole point of showing both: the paywall must quote the same
         * account the registry resolved, or the rail is lying somewhere. */
        agrees:
          !!challenge.accept?.payTo && !!hederaAccount && challenge.accept.payTo === hederaAccount,
      },
      settlement,
      readAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

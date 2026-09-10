import { NextResponse } from "next/server";
import {
  submitEnterAdministration,
  ActionInFlightError,
  LowBalanceError,
  AlreadyInStateError,
  TransactionRevertedError,
  CooldownError,
  DailyBudgetExhaustedError,
} from "../../../../lib/chain-actions.server";

export async function POST() {
  try {
    const txHash = await submitEnterAdministration();
    return NextResponse.json({ txHash });
  } catch (err) {
    if (err instanceof AlreadyInStateError) {
      return NextResponse.json({ alreadyInState: err.status }, { status: 200 });
    }
    if (err instanceof ActionInFlightError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    // Both of these mean "not from our key" - and for this particular call
    // that is recoverable client-side, because enterAdministration() is
    // permissionless. `selfServe` tells the UI to offer the wallet path.
    if (err instanceof CooldownError) {
      return NextResponse.json(
        { error: err.message, selfServe: true, retryAfter: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
      );
    }
    if (err instanceof DailyBudgetExhaustedError) {
      return NextResponse.json({ error: err.message, selfServe: true }, { status: 429 });
    }
    if (err instanceof LowBalanceError) {
      return NextResponse.json({ error: err.message, selfServe: true }, { status: 503 });
    }
    if (err instanceof TransactionRevertedError) {
      return NextResponse.json({ error: err.message, txHash: err.txHash }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "enterAdministration failed";
    if (message.includes("TooEarly")) {
      return NextResponse.json({ error: "Heartbeat window hasn't lapsed yet" }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

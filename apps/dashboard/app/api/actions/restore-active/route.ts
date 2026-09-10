import { NextResponse } from "next/server";
import {
  submitRestoreActive,
  ActionInFlightError,
  LowBalanceError,
  AlreadyInStateError,
  TransactionRevertedError,
  CooldownError,
  DailyBudgetExhaustedError,
} from "../../../../lib/chain-actions.server";

export async function POST() {
  try {
    const txHash = await submitRestoreActive();
    return NextResponse.json({ txHash });
  } catch (err) {
    if (err instanceof AlreadyInStateError) {
      // Not an error: someone else's request already got there first.
      return NextResponse.json({ alreadyInState: err.status }, { status: 200 });
    }
    if (err instanceof ActionInFlightError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    // No `selfServe` hint here, unlike enterAdministration: restoreActive is
    // gated to the recoveryAuthority, so a visitor's own wallet cannot stand
    // in for the operator's. Throttling this one genuinely means "wait".
    if (err instanceof CooldownError) {
      return NextResponse.json(
        { error: err.message, retryAfter: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
      );
    }
    if (err instanceof DailyBudgetExhaustedError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof LowBalanceError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof TransactionRevertedError) {
      return NextResponse.json({ error: err.message, txHash: err.txHash }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "restoreActive failed" },
      { status: 500 },
    );
  }
}

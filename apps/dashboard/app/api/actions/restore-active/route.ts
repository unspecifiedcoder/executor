import { NextResponse } from "next/server";
import {
  submitRestoreActive,
  ActionInFlightError,
  LowBalanceError,
  AlreadyInStateError,
  TransactionRevertedError,
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

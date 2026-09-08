import { NextResponse } from "next/server";
import {
  submitEnterAdministration,
  ActionInFlightError,
  LowBalanceError,
  AlreadyInStateError,
  TransactionRevertedError,
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
    if (err instanceof LowBalanceError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
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

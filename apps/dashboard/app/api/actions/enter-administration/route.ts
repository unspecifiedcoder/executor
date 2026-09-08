import { NextResponse } from "next/server";
import {
  submitEnterAdministration,
  ActionInFlightError,
  LowBalanceError,
} from "../../../../lib/chain-actions.server";

export async function POST() {
  try {
    const txHash = await submitEnterAdministration();
    return NextResponse.json({ txHash });
  } catch (err) {
    if (err instanceof ActionInFlightError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof LowBalanceError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "enterAdministration failed";
    // The contract itself is the source of truth on timing - a revert here
    // just means the heartbeat window hasn't actually lapsed yet.
    if (message.includes("TooEarly")) {
      return NextResponse.json({ error: "Heartbeat window hasn't lapsed yet" }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

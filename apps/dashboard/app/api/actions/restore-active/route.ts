import { NextResponse } from "next/server";
import { submitRestoreActive, ActionInFlightError, LowBalanceError } from "../../../../lib/chain-actions.server";

export async function POST() {
  try {
    const txHash = await submitRestoreActive();
    return NextResponse.json({ txHash });
  } catch (err) {
    if (err instanceof ActionInFlightError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof LowBalanceError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "restoreActive failed" },
      { status: 500 },
    );
  }
}

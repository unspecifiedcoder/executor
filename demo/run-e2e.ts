/**
 * The full demo run: birth -> paid requests -> kill -> flip -> claims ->
 * plan -> payout -> succession. Pass --scripted for the timed judging run
 * (see script.md for the shot list); without it, runs at real interval
 * speed for local debugging.
 */
async function main(): Promise<void> {
  const scripted = process.argv.includes("--scripted");
  console.log(`[e2e] starting run (scripted=${scripted})`);

  // TODO, in order:
  // 1. seed() - register ENS name, fund wallets, create creditors.
  // 2. Start agent-debtor's heartbeat + both paid servers.
  // 3. agent-client makes paid requests against both.
  // 4. kill agent-debtor (heartbeat + servers stop).
  // 5. Wait out heartbeatInterval, call Receiver.declareAdministration().
  // 6. Run cre-workflow's runLiquidationCheck() against seeded claims.
  // 7. Call Receiver.declareLiquidation() with the DON-signed report.
  // 8. agent-trustee: discoverCreditors() -> buildWaterfallPlan() ->
  //    approveViaKeyRing() -> Estate.approvePlan() -> Estate.executePlan().
  // 9. Confirm Receiver.assignSuccessor() reflects the new agent identity.

  throw new Error("run-e2e: not implemented");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

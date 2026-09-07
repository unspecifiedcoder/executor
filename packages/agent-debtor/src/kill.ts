/**
 * The demo switch. Stops the heartbeat and both paid servers, simulating
 * the agent going dark - crash, compromised key, or retirement.
 */
export function killAgent(stopHeartbeat: () => void, stopServers: () => void): void {
  console.log("[kill] agent-debtor going dark");
  stopHeartbeat();
  stopServers();
}

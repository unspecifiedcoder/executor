export default function VitalSignsPage() {
  // TODO: fetch heartbeat/status/claims from packages/bazantic's REST API
  // (not a direct chain RPC call - see README) and render the three panels.
  return (
    <main>
      <h1>Executor — Vital Signs</h1>
      <section id="heartbeat">{/* last ping, countdown, status dot */}</section>
      <section id="name-card">{/* ENS subname, executor:status, payout addrs */}</section>
      <section id="creditor-bars">{/* one bar per claim, by PriorityClass */}</section>
    </main>
  );
}

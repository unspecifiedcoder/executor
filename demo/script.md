# Demo script — the 10-second visual

The shot judges should walk away remembering:

1. **Dashboard, agent alive** (2s) — heartbeat dot green, ENS status
   `alive`, both paid endpoints responding.
2. **Kill switch** (1s) — run `just kill` on camera, heartbeat dot goes
   stale.
3. **Administration flips** (2s) — `declareAdministration()` fires,
   status text updates to `under_administration`.
4. **CRE simulation output** (2s) — cut to the `simulation.log` output
   showing claims verified + insolvency check, then the DON-signed report
   landing in `declareLiquidation()`.
5. **Waterfall pays out** (2s) — creditor bars on the dashboard fill in,
   Secured before Unsecured.
6. **Succession** (1s) — the ENS name card flips to the successor address.

Full narration and timing lives in the pitch deck; this file is just the
shot list for whoever's driving the demo machine.

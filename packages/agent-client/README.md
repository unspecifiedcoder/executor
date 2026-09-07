# agent-client

The paying customer in the demo. Built on Circle's Agent Stack kit plus
`@x402/hedera`, so the same client can pay `agent-debtor` on either
Hedera (x402) or Arc (Nanopayments) without branching client-side logic.

Used for two things in the demo:
1. Pre-kill: proves the paid service actually works (the "before" state).
2. Post-liquidation: files a claim for a payment that was made but not
   fulfilled, becoming one of the creditors `agent-trustee` discovers.

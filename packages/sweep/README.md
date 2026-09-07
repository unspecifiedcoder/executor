# sweep

Moves the estate's standing-approval funds from Sepolia to Arc via CCTP
v2: pull the agent's pre-authorized USDC approval, burn on Sepolia, mint
on Arc into `Estate`. The standing approval itself is granted during
`RegisterAgent.s.sol` (the living will), not by this script - this only
executes the transfer once Liquidation has been declared.

# Uniswap feedback — withdrawn

This project is not filing for the Uniswap track. The integration this
write-up was reserved for — `packages/optional/liquidation/`, selling non-USDC
estate assets into USDC before the distribution waterfall runs — was never
built. `packages/optional/liquidation/src/index.ts` was a stub, and has since
been deleted rather than left standing in for a plan.

The waterfall it would have fed does now exist, is deployed, and has run:
`contracts/src/Estate.sol`, live on Sepolia at
`0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`, distributes a single ERC-20 by
priority class with pro-rata splitting inside a class, and has done so twice
with real USDC (see `README.md`). Its constructor binds it
to Circle's Sepolia USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, and that
is the only token it settles. Nothing values a non-USDC asset and nothing swaps
one, so there is no Uniswap integration to file feedback about.

Rather than submit a feedback form about an integration we did not do, the
claim is withdrawn. See `docs/PRIZES.md` for the three tracks we do file for.

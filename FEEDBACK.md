# Uniswap feedback — withdrawn

This project is not filing for the Uniswap track. The integration this
write-up was reserved for — `packages/optional/liquidation/`, selling non-USDC
estate assets into USDC before the distribution waterfall runs — was never
built. `packages/optional/liquidation/src/index.ts` is a stub.

The waterfall it would have fed does now exist and is deployed:
`contracts/src/Estate.sol`, live on Sepolia at
`0xD67a10D5466d311C2f995744937c7b9e1734286f`, distributes a single ERC-20 by
priority class with pro-rata splitting inside a class. Its constructor binds it
to Circle's Sepolia USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, and that
is the only token it settles. Nothing values a non-USDC asset and nothing swaps
one, so there is no Uniswap integration to file feedback about.

Rather than submit a feedback form about an integration we did not do, the
claim is withdrawn. See `docs/PRIZES.md` for the three tracks we do file for.

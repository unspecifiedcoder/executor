import { namehash, type Address, type PublicClient } from "viem";

/**
 * All ENSv2 resolution in this repo goes through here, mirroring
 * `contracts/src/adapters/EnsAdapter.sol` on the Solidity side. Never call
 * a resolver directly - always go through the Universal Resolver so
 * wildcard/offchain resolution keeps working as ENSv2 evolves.
 */

export const COIN_TYPE_ETH = 60n;
export const COIN_TYPE_ARC = 3030n;
export const TEXT_KEY_STATUS = "executor:status";

const UNIVERSAL_RESOLVER_ABI = [
  {
    name: "resolve",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "", type: "bytes" },
      { name: "resolver", type: "address" },
    ],
  },
] as const;

export interface EnsClientConfig {
  client: PublicClient;
  universalResolver: Address;
}

/** Resolve the payout address for `name` on a given ENSIP-9 coin type. */
export async function resolvePayoutAddress(
  _config: EnsClientConfig,
  name: string,
  _coinType: bigint = COIN_TYPE_ETH,
): Promise<Address | null> {
  const node = namehash(name);
  void node;
  // TODO: encode an `addr(node, coinType)` call, wrap it through
  // Universal Resolver's `resolve(name, data)`, and decode the result.
  throw new Error("resolvePayoutAddress: not implemented");
}

/** Read the `executor:status` text record for `name`. */
export async function resolveStatus(_config: EnsClientConfig, name: string): Promise<string | null> {
  const node = namehash(name);
  void node;
  // TODO: same resolve() pattern as above, encoding a text() call.
  throw new Error("resolveStatus: not implemented");
}

export const CHAIN_IDS = {
  sepolia: 11_155_111,
  arcTestnet: 5_042, // placeholder - confirm against Circle's Arc testnet docs at deploy time
  hederaTestnet: 296,
} as const;

export type ChainKey = keyof typeof CHAIN_IDS;

export interface ChainConfig {
  chainId: number;
  rpcUrlEnvVar: string;
}

export const CHAINS: Record<ChainKey, ChainConfig> = {
  sepolia: { chainId: CHAIN_IDS.sepolia, rpcUrlEnvVar: "SEPOLIA_RPC_URL" },
  arcTestnet: { chainId: CHAIN_IDS.arcTestnet, rpcUrlEnvVar: "ARC_TESTNET_RPC_URL" },
  hederaTestnet: { chainId: CHAIN_IDS.hederaTestnet, rpcUrlEnvVar: "HEDERA_TESTNET_RPC_URL" },
};

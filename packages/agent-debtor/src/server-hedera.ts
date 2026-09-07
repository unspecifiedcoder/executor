import { resolvePayoutAddress, COIN_TYPE_ETH, type EnsClientConfig } from "@executor/shared";

/**
 * x402-gated paid service, fronted by Blocky402 on Hedera. `payTo` is
 * resolved fresh from ENS on every request instead of being a fixed
 * address baked into the middleware config, so the agent's succession
 * (Receiver taking over the addr record) changes where payments land
 * without redeploying this service.
 */

export interface ServerConfig {
  ensConfig: EnsClientConfig;
  agentEnsName: string;
  port: number;
}

export async function resolveCurrentPayTo(config: ServerConfig) {
  const payTo = await resolvePayoutAddress(config.ensConfig, config.agentEnsName, COIN_TYPE_ETH);
  if (!payTo) throw new Error(`No payout address set for ${config.agentEnsName}`);
  return payTo;
}

export async function startServer(config: ServerConfig): Promise<void> {
  // TODO: wire up Blocky402 x402 middleware, calling `resolveCurrentPayTo`
  // per-request (or on a short cache) as the `payTo` param, and mount the
  // actual paid endpoint behind it.
  console.log(`[agent-debtor:hedera] would listen on :${config.port} for ${config.agentEnsName}`);
}

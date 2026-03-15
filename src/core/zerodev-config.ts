/**
 * ZeroDev configuration loader.
 *
 * Reads ZERODEV_RPC from environment and resolves the chain
 * configuration for ZeroDev Kernel smart wallet operations.
 *
 * @module zerodev-config
 */

import { arbitrum, arbitrumSepolia } from "viem/chains";
import type { Chain } from "viem";
import { getActiveNetwork } from "./config.js";
import type { NetworkName } from "./types.js";

/** Chain objects for viem, mapped by our network names. */
const VIEM_CHAINS: Record<string, Chain> = {
  "arbitrum-sepolia": arbitrumSepolia,
  "arbitrum-one": arbitrum,
};

export interface ZeroDevConfig {
  rpcUrl: string;
  chain: Chain;
  network: NetworkName;
}

/**
 * Loads and validates ZeroDev configuration from environment variables.
 *
 * Requires ZERODEV_RPC to be set. Get your RPC URL from
 * https://dashboard.zerodev.app — format:
 *   https://rpc.zerodev.app/api/v3/{PROJECT_ID}/chain/{CHAIN_ID}
 *
 * @returns Validated ZeroDev configuration.
 * @throws If ZERODEV_RPC is not set or the network is unsupported.
 */
export function getZeroDevConfig(): ZeroDevConfig {
  const rpcUrl = process.env.ZERODEV_RPC;
  if (!rpcUrl) {
    throw new Error(
      "ZERODEV_RPC is required for smart wallet operations.\n" +
        "Get your RPC URL from https://dashboard.zerodev.app\n" +
        "Format: https://rpc.zerodev.app/api/v3/{PROJECT_ID}/chain/{CHAIN_ID}\n" +
        "Set it in your .env file."
    );
  }

  const network = getActiveNetwork();
  const chain = VIEM_CHAINS[network];
  if (!chain) {
    throw new Error(
      `Network "${network}" is not supported for smart wallets. ` +
        `Supported: ${Object.keys(VIEM_CHAINS).join(", ")}`
    );
  }

  return { rpcUrl, chain, network };
}

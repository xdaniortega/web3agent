/**
 * Network configuration and provider management.
 * @module config
 */

import { ethers } from "ethers";
import type { NetworkName, NetworkConfig } from "./types.js";

/**
 * Registry of supported networks.
 * Each entry maps a NetworkName to its chain ID, RPC URL template, and env var.
 */
const NETWORKS: Record<NetworkName, NetworkConfig> = {
  "arbitrum-sepolia": {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    defaultRpcUrl: "https://arb-sepolia.g.alchemy.com/v2",
  },
  "arbitrum-one": {
    name: "Arbitrum One",
    chainId: 42161,
    defaultRpcUrl: "https://arb-mainnet.g.alchemy.com/v2",
  },
  // NOTE: Chain ID 23888 for Robinhood Testnet should be verified before production use.
  "robinhood-testnet": {
    name: "Robinhood Testnet",
    chainId: 23888,
    defaultRpcUrl: "https://robinhood-testnet.g.alchemy.com/v2",
  },
};

/**
 * Returns the active network name from the NETWORK environment variable.
 * Defaults to "arbitrum-sepolia" if not set.
 *
 * @returns The active network name.
 * @throws If the NETWORK value is not a supported network.
 */
export function getActiveNetwork(): NetworkName {
  const raw = process.env.NETWORK || "arbitrum-sepolia";
  if (!(raw in NETWORKS)) {
    throw new Error(
      `Unsupported network "${raw}". Supported networks: ${Object.keys(NETWORKS).join(", ")}`
    );
  }
  return raw as NetworkName;
}

/**
 * Returns the configuration for a given network.
 *
 * @param network - The network name. Defaults to the active network.
 * @returns The network configuration object.
 */
export function getNetworkConfig(network?: NetworkName): NetworkConfig {
  const name = network ?? getActiveNetwork();
  return NETWORKS[name];
}

/**
 * Returns the RPC endpoint URL for the active network.
 *
 * Uses the RPC_URL environment variable if set, otherwise falls back
 * to the network's default RPC URL.
 *
 * @param network - The network name. Defaults to the active network.
 * @returns The RPC endpoint URL.
 * @throws If RPC_URL is not set.
 */
export function getRpcUrl(network?: NetworkName): string {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      `Missing RPC endpoint. Set the RPC_URL environment variable.\n` +
        `Example: https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
    );
  }
  return rpcUrl;
}

/**
 * Returns an ethers JsonRpcProvider for the active network.
 *
 * Uses the RPC_URL environment variable as the endpoint.
 *
 * @param network - The network name. Defaults to the active network.
 * @returns A configured ethers JsonRpcProvider.
 * @throws If RPC_URL is not set.
 */
export function getProvider(network?: NetworkName): ethers.JsonRpcProvider {
  const config = getNetworkConfig(network);
  const rpcUrl = getRpcUrl(network);
  return new ethers.JsonRpcProvider(rpcUrl, config.chainId);
}

/**
 * Returns the chain ID for the active network.
 *
 * @param network - The network name. Defaults to the active network.
 * @returns The EVM chain ID.
 */
export function getChainId(network?: NetworkName): number {
  return getNetworkConfig(network).chainId;
}

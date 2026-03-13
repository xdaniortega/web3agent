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
    rpcUrlTemplate: "https://arb-sepolia.g.alchemy.com/v2/{key}",
    alchemyKeyEnvVar: "ALCHEMY_ARBITRUM_SEPOLIA_KEY",
  },
  "arbitrum-one": {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrlTemplate: "https://arb-mainnet.g.alchemy.com/v2/{key}",
    alchemyKeyEnvVar: "ALCHEMY_ARBITRUM_ONE_KEY",
  },
  // NOTE: Chain ID 23888 for Robinhood Testnet should be verified before production use.
  "robinhood-testnet": {
    name: "Robinhood Testnet",
    chainId: 23888,
    rpcUrlTemplate: "https://robinhood-testnet.g.alchemy.com/v2/{key}",
    alchemyKeyEnvVar: "ALCHEMY_ROBINHOOD_TESTNET_KEY",
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
 * Returns an ethers JsonRpcProvider for the active network.
 *
 * Reads the Alchemy API key from the corresponding environment variable.
 *
 * @param network - The network name. Defaults to the active network.
 * @returns A configured ethers JsonRpcProvider.
 * @throws If the required Alchemy API key environment variable is not set.
 */
export function getProvider(network?: NetworkName): ethers.JsonRpcProvider {
  const config = getNetworkConfig(network);
  const apiKey = process.env[config.alchemyKeyEnvVar];

  if (!apiKey) {
    throw new Error(
      `Missing Alchemy API key. Set the ${config.alchemyKeyEnvVar} environment variable.\n` +
        `Get a free key at https://dashboard.alchemy.com/`
    );
  }

  const rpcUrl = config.rpcUrlTemplate.replace("{key}", apiKey);
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

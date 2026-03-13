/**
 * GOAT SDK integration — provides onchain tools via @goat-sdk/adapter-langchain.
 *
 * Tools are organized into categories for the interactive CLI picker.
 * Uses viem wallet adapter with the agent's private key.
 *
 * @module goat-tools
 */

import { getOnChainTools } from "@goat-sdk/adapter-langchain";
import { viem } from "@goat-sdk/wallet-viem";
import { sendETH } from "@goat-sdk/wallet-evm";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, arbitrum } from "viem/chains";
import { getRpcUrl, getActiveNetwork } from "./config.js";

/** A GOAT plugin entry with metadata for the CLI. */
export interface GoatPluginEntry {
  name: string;
  description: string;
  category: string;
  create: () => Promise<any>;
}

/** All available GOAT plugins organized by category. */
export const GOAT_PLUGIN_REGISTRY: GoatPluginEntry[] = [
  // --- Tokens ---
  {
    name: "send-eth",
    description: "Send ETH to any address",
    category: "Tokens",
    create: async () => sendETH(),
  },
  {
    name: "erc20",
    description: "Transfer, approve, and check ERC-20 token balances",
    category: "Tokens",
    create: async () => {
      const { erc20 } = await import("@goat-sdk/plugin-erc20");
      return erc20({ tokens: [] });
    },
  },
  {
    name: "erc721",
    description: "Mint, transfer, and manage ERC-721 NFTs",
    category: "Tokens",
    create: async () => {
      const { erc721 } = await import("@goat-sdk/plugin-erc721");
      return erc721({ tokens: [] });
    },
  },
  {
    name: "erc1155",
    description: "Manage ERC-1155 multi-token assets",
    category: "Tokens",
    create: async () => {
      const { erc1155 } = await import("@goat-sdk/plugin-erc1155");
      return erc1155({ tokens: [] });
    },
  },

  // --- DeFi ---
  {
    name: "uniswap",
    description: "Swap tokens on Uniswap",
    category: "DeFi",
    create: async () => {
      const { uniswap } = await import("@goat-sdk/plugin-uniswap");
      return uniswap({
        apiKey: process.env.UNISWAP_API_KEY ?? "",
        baseUrl: "https://trade-api.gateway.uniswap.org/v1",
      });
    },
  },
  {
    name: "1inch",
    description: "Swap tokens via 1inch aggregator",
    category: "DeFi",
    create: async () => {
      const { oneInch } = await import("@goat-sdk/plugin-1inch");
      return oneInch({ apiKey: process.env.ONEINCH_API_KEY ?? "" });
    },
  },
  {
    name: "0x",
    description: "Swap tokens via 0x protocol",
    category: "DeFi",
    create: async () => {
      const { zeroEx } = await import("@goat-sdk/plugin-0x");
      return zeroEx({ apiKey: process.env.ZEROX_API_KEY ?? "" });
    },
  },
  {
    name: "superfluid",
    description: "Create and manage token streams (Superfluid)",
    category: "DeFi",
    create: async () => {
      const { superfluid } = await import("@goat-sdk/plugin-superfluid");
      return superfluid();
    },
  },

  // --- Bridges ---
  {
    name: "lifi",
    description: "Cross-chain swaps and bridges via LI.FI",
    category: "Bridges",
    create: async () => {
      const { lifi } = await import("@goat-sdk/plugin-lifi");
      return lifi({ apiKey: process.env.LIFI_API_KEY });
    },
  },
  {
    name: "debridge",
    description: "Cross-chain bridges via deBridge",
    category: "Bridges",
    create: async () => {
      const { debridge } = await import("@goat-sdk/plugin-debridge");
      return debridge();
    },
  },

  // --- Data & Info ---
  {
    name: "coingecko",
    description: "Token prices and market data from CoinGecko",
    category: "Data",
    create: async () => {
      const { coingecko } = await import("@goat-sdk/plugin-coingecko");
      return coingecko({ apiKey: process.env.COINGECKO_API_KEY ?? "" });
    },
  },
  {
    name: "dexscreener",
    description: "DEX pair data and token analytics",
    category: "Data",
    create: async () => {
      const { dexscreener } = await import("@goat-sdk/plugin-dexscreener");
      return dexscreener();
    },
  },
  {
    name: "etherscan",
    description: "Read contract data and transaction history",
    category: "Data",
    create: async () => {
      const { etherscan } = await import("@goat-sdk/plugin-etherscan");
      return etherscan({ apiKey: process.env.ETHERSCAN_API_KEY ?? "" });
    },
  },

  // --- Identity & Naming ---
  {
    name: "ens",
    description: "Resolve and manage ENS domain names",
    category: "Identity",
    create: async () => {
      const { ens } = await import("@goat-sdk/plugin-ens");
      return ens({ provider: getRpcUrl() });
    },
  },

  // --- Low-level ---
  {
    name: "jsonrpc",
    description: "Raw JSON-RPC calls to any EVM node",
    category: "Low-level",
    create: async () => {
      const { jsonrpc } = await import("@goat-sdk/plugin-jsonrpc");
      return jsonrpc({ endpoint: getRpcUrl() });
    },
  },
];

/** Get category names in display order. */
export function getGoatCategories(): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const entry of GOAT_PLUGIN_REGISTRY) {
    if (!seen.has(entry.category)) {
      seen.add(entry.category);
      categories.push(entry.category);
    }
  }
  return categories;
}

/** Get plugins for a category. */
export function getGoatPluginsByCategory(category: string): GoatPluginEntry[] {
  return GOAT_PLUGIN_REGISTRY.filter((e) => e.category === category);
}

/**
 * Resolves selected GOAT plugin names into LangChain tools.
 */
export async function resolveGoatTools(
  pluginNames: string[],
  agentPrivateKey: string
): Promise<any[]> {
  if (pluginNames.length === 0) return [];

  const network = getActiveNetwork();
  const chain = network === "arbitrum-one" ? arbitrum : arbitrumSepolia;
  const rpcUrl = getRpcUrl();

  const account = privateKeyToAccount(agentPrivateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    transport: http(rpcUrl),
    chain,
  });

  const plugins: any[] = [];
  for (const name of pluginNames) {
    const entry = GOAT_PLUGIN_REGISTRY.find((e) => e.name === name);
    if (!entry) {
      console.warn(`[goat] Unknown plugin "${name}", skipping.`);
      continue;
    }
    try {
      const plugin = await entry.create();
      plugins.push(plugin);
    } catch (err) {
      console.warn(`[goat] Failed to load "${name}": ${err instanceof Error ? err.message : err}`);
    }
  }

  if (plugins.length === 0) return [];

  // Cast through any to avoid viem version mismatch between root and @goat-sdk/wallet-viem
  const tools = await getOnChainTools({
    wallet: viem(walletClient as any),
    plugins,
  });

  return tools;
}

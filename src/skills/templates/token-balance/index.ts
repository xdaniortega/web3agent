/**
 * Token balance skill — check ETH and ERC-20 balances.
 */

import { ethers } from "ethers";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProvider } from "../../../../src/core/config.js";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export function createSkill(_agentPrivateKey: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "token-balance",
    description:
      "Check the ETH or ERC-20 token balance of a wallet address. " +
      "Omit tokenAddress to check ETH balance.",
    schema: z.object({
      address: z.string().describe("Wallet address to check (0x...)"),
      tokenAddress: z
        .string()
        .optional()
        .describe("ERC-20 token contract address. Omit for ETH balance."),
    }),
    func: async ({ address, tokenAddress }): Promise<string> => {
      try {
        const provider = getProvider();

        if (!tokenAddress) {
          const balance = await provider.getBalance(address);
          const eth = ethers.formatEther(balance);
          return JSON.stringify({ address, token: "ETH", balance: eth });
        }

        const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const [rawBalance, decimals, symbol] = await Promise.all([
          token.balanceOf(address),
          token.decimals(),
          token.symbol().catch(() => "UNKNOWN"),
        ]);
        const balance = ethers.formatUnits(rawBalance, decimals);
        return JSON.stringify({ address, token: symbol, balance });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: message });
      }
    },
  });
}

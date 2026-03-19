// SPDX-License-Identifier: Apache-2.0

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  defineChain,
} from "viem"
import { getRpcUrl, getChainId } from "../../core/config.js"

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const

/**
 * @notice Checks the ETH or ERC-20 token balance of a wallet address.
 * Never throws, returns "{amount} {symbol}" on success or an error message on failure.
 */
export const tokenBalanceTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "get_token_balance",
  description:
    "Check the ETH or ERC-20 token balance of a wallet address. " +
    "Omit tokenAddress to check native ETH balance.",
  schema: z.object({
    address: z.string().optional().describe(
      "Wallet address to check balance for. If omitted, uses the agent's own wallet (AGENT_PRIVATE_KEY)."
    ),
    tokenAddress: z.string().optional().describe(
      "ERC-20 contract address. If omitted, returns native ETH balance."
    ),
  }),
  func: async ({ address: addressInput, tokenAddress }): Promise<string> => {
    // Default to agent's own wallet if no address provided
    let address = addressInput
    if (!address) {
      const pk = process.env.AGENT_PRIVATE_KEY
      if (!pk) return "Error: No address provided and AGENT_PRIVATE_KEY is not set."
      const { ethers } = await import("ethers")
      address = new ethers.Wallet(pk).address
    }
    try {
      const rpcUrl = getRpcUrl()
      const chain = defineChain({
        id: getChainId(),
        name: "Arbitrum",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      })

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      })

      if (!tokenAddress) {
        const balance = await publicClient.getBalance({
          address: address as `0x${string}`,
        })
        return `${formatEther(balance)} ETH`
      }

      const [rawBalance, decimals, symbol] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "symbol",
        }),
      ])

      return `${formatUnits(rawBalance, decimals)} ${symbol}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  },
})

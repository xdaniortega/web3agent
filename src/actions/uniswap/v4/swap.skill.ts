// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../../types.js"
import { getChainId } from "../../../core/config.js"
import { TOKEN_CONFIG } from "../shared/tokens.js"

function buildContext(): string {
  const chainId = getChainId()
  const tokens = TOKEN_CONFIG[chainId]

  if (!tokens) {
    return `Uniswap V4 swaps are not configured for chain ${chainId}.`
  }

  return `
    You can swap tokens using Uniswap V4 on ${tokens.name} (chain ${chainId}).
    You have these tools: uniswap_v4_quote, uniswap_v4_swap, get_token_balance.

    ## Key V4 Differences from V3
    - V4 uses native ETH directly (address(0)) — no WETH wrapping needed
    - V4 uses a singleton PoolManager — all pools in one contract
    - V4 uses Permit2 for token approvals (handled automatically by the tool)
    - V4 swaps go through the UniversalRouter

    ## Two-Step Flow

    ### Step 1: Get a Quote
    Use uniswap_v4_quote to get the expected output amount.
    - For native ETH, pass "ETH" or the zero address as tokenIn/tokenOut.
    - The tool sorts tokens and builds the PoolKey automatically.
    - It tries multiple fee tiers if the first one fails.
    - Show the user the expected output before proceeding.

    ### Step 2: Execute the Swap
    Use uniswap_v4_swap with the values returned from the quote.
    Pass all fields from the quote result directly.
    - The tool handles Permit2 approval automatically for ERC-20 tokens.
    - The tool handles native ETH value automatically.
    - Default slippage is 0.5%.

    ## Common Token Addresses (${tokens.name})
    - USDC: ${tokens.usdc} (6 decimals)${tokens.usdt !== "0x0000000000000000000000000000000000000000" ? `\n    - USDT: ${tokens.usdt} (6 decimals)` : ""}
    - ETH: native, 18 decimals (use "ETH" or zero address)
    - WETH: ${tokens.weth} (18 decimals, but V4 prefers native ETH)

    ## CRITICAL RULES
    - ALWAYS call uniswap_v4_quote first and show the expected output before executing
    - If the swap amount exceeds 0.1 ETH equivalent, ask for confirmation
    - Use get_token_balance to verify balances before and after swaps
    - Token amounts in uniswap_v4_quote are human-readable (e.g. "0.01", "100")
    - Token amounts in uniswap_v4_swap are in smallest unit (from quote result)
    - For ETH, use "ETH" or zero address — NOT the WETH address
  `
}

/**
 * @notice Skill context for Uniswap V4 on-chain swap integration.
 * Guides the agent through quote → swap using dedicated V4 tools.
 */
export const uniswapV4SwapSkill: Skill = {
  name: "uniswap-v4-swap",
  description: "Guidance for swapping tokens via Uniswap V4",
  get context() {
    return buildContext()
  },
  examples: [
    {
      user: "Swap 0.01 ETH for USDC on V4",
      thought: "Use uniswap_v4_quote with tokenIn='ETH', tokenOut=USDC, amountIn='0.01'. V4 uses native ETH directly.",
      action: "1) uniswap_v4_quote, 2) show expected output, 3) uniswap_v4_swap with quote values",
    },
    {
      user: "Quote 100 USDC to ETH on V4",
      thought: "Quote only, no swap. USDC has 6 decimals.",
      action: "uniswap_v4_quote USDC→ETH and show the expected output",
    },
    {
      user: "Swap 50 USDC for USDT on V4",
      thought: "ERC-20 to ERC-20 swap. Tool handles Permit2 approval automatically.",
      action: "1) uniswap_v4_quote, 2) show expected output, 3) uniswap_v4_swap with quote values",
    },
  ],
}

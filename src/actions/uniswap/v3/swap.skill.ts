// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../../types.js"
import { getChainId } from "../../../core/config.js"
import { TOKEN_CONFIG } from "../shared/tokens.js"

function buildContext(): string {
  const chainId = getChainId()
  const tokens = TOKEN_CONFIG[chainId]

  if (!tokens) {
    return `Uniswap V3 swaps are not configured for chain ${chainId}.`
  }

  return `
    You can swap tokens using Uniswap V3 on ${tokens.name} (chain ${chainId}).
    You have these tools: uniswap_v3_quote, uniswap_v3_swap, get_token_balance.

    ## Two-Step Flow

    ### Step 1: Get a Quote
    Use uniswap_v3_quote to get the expected output amount.
    - For native ETH, pass "ETH" or the zero address as tokenIn/tokenOut.
    - The tool resolves ETH to WETH automatically and tries multiple fee tiers.
    - Show the user the expected output before proceeding.

    ### Step 2: Execute the Swap
    Use uniswap_v3_swap with the values returned from the quote.
    Pass tokenIn, tokenOut, amountIn, amountOut, fee, isNativeIn, isNativeOut directly from the quote result.
    - The tool handles ERC-20 approval automatically.
    - The tool handles ETH wrapping/unwrapping automatically.
    - Default slippage is 0.5%.

    ## Common Token Addresses (${tokens.name})
    - WETH: ${tokens.weth} (18 decimals)
    - USDC: ${tokens.usdc} (6 decimals)${tokens.usdt !== "0x0000000000000000000000000000000000000000" ? `\n    - USDT: ${tokens.usdt} (6 decimals)` : ""}
    - ETH: native, 18 decimals (use "ETH" or zero address)

    ## CRITICAL RULES
    - ALWAYS call uniswap_v3_quote first and show the expected output before executing
    - If the swap amount exceeds 0.1 ETH equivalent, ask for confirmation
    - Use get_token_balance to verify balances before and after swaps
    - Token amounts in uniswap_v3_quote are human-readable (e.g. "0.01", "100")
    - Token amounts in uniswap_v3_swap are in smallest unit (from quote result)
  `
}

/**
 * @notice Skill context for Uniswap V3 on-chain swap integration.
 * Guides the agent through quote → swap using dedicated V3 tools.
 */
export const uniswapV3SwapSkill: Skill = {
  name: "uniswap-v3-swap",
  description: "Guidance for swapping tokens via Uniswap V3",
  get context() {
    return buildContext()
  },
  examples: [
    {
      user: "Swap 0.01 ETH for USDC on V3",
      thought: "Use uniswap_v3_quote with tokenIn='ETH', tokenOut=USDC, amountIn='0.01'.",
      action: "1) uniswap_v3_quote, 2) show expected output, 3) uniswap_v3_swap with quote values",
    },
    {
      user: "How much USDC would I get for 0.05 ETH?",
      thought: "Quote only, no swap needed.",
      action: "uniswap_v3_quote ETH→USDC and show the expected output",
    },
    {
      user: "Swap 10 USDC for ETH",
      thought: "USDC→ETH swap. Tool handles approval and WETH unwrapping.",
      action: "1) uniswap_v3_quote, 2) show expected output, 3) uniswap_v3_swap with quote values",
    },
  ],
}

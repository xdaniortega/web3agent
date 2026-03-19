// SPDX-License-Identifier: Apache-2.0

import { tokenBalanceTool } from "../../generic/tools/index.js"
import { uniswapV3QuoteTool, uniswapV3SwapTool } from "./tools/index.js"
import { uniswapV3SwapSkill } from "./swap.skill.js"
import type { Action } from "../../types.js"

export { uniswapV3QuoteTool, uniswapV3SwapTool } from "./tools/index.js"
export { uniswapV3SwapSkill } from "./swap.skill.js"

/**
 * @notice Action for swapping tokens via Uniswap V3 on-chain contracts.
 * Uses SwapRouter02 + QuoterV2. Works on mainnet and testnet.
 */
export const UniswapV3SwapAction = (): Action => ({
  name: "uniswap-v3-swap",
  description: "Swap tokens on Uniswap V3 via direct contract calls",
  tools: [uniswapV3QuoteTool, uniswapV3SwapTool, tokenBalanceTool],
  skill: uniswapV3SwapSkill,
})

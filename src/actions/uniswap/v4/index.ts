// SPDX-License-Identifier: Apache-2.0

import { tokenBalanceTool } from "../../generic/tools/index.js"
import { uniswapV4QuoteTool, uniswapV4SwapTool } from "./tools/index.js"
import { uniswapV4SwapSkill } from "./swap.skill.js"
import type { Action } from "../../types.js"

export { uniswapV4QuoteTool, uniswapV4SwapTool } from "./tools/index.js"
export { uniswapV4SwapSkill } from "./swap.skill.js"

/**
 * @notice Action for swapping tokens via Uniswap V4 (PoolManager + UniversalRouter).
 * Supports native ETH directly. Works on mainnet and testnet.
 */
export const UniswapV4SwapAction = (): Action => ({
  name: "uniswap-v4-swap",
  description: "Swap tokens on Uniswap V4 via UniversalRouter",
  tools: [uniswapV4QuoteTool, uniswapV4SwapTool, tokenBalanceTool],
  skill: uniswapV4SwapSkill,
})

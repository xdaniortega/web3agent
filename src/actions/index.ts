// SPDX-License-Identifier: Apache-2.0

// Types
export * from "./types.js"

// Level 2 — standalone tools
export * from "./tools/index.js"

// Skills — exported separately for advanced use
export * from "./skills/index.js"

// Level 3 — dynamic ABI tools
export * from "./dynamic/index.js"

// Level 1 — Actions (skill + tools bundled)
import { sendEthTool } from "./tools/send-eth.tool.js"
import { tokenBalanceTool } from "./tools/token-balance.tool.js"
import { sendEthSkill } from "./skills/send-eth.skill.js"
import { tokenBalanceSkill } from "./skills/token-balance.skill.js"
import type { Action } from "./types.js"

/**
 * @notice Action for sending ETH on Arbitrum.
 * Includes tool + skill with safety checks baked in.
 */
export const SendEthAction = (): Action => ({
  name: "send-eth",
  description: "Send ETH on Arbitrum with built-in confirmation and safety checks",
  tools: [sendEthTool],
  skill: sendEthSkill,
})

/**
 * @notice Action for checking token balances on Arbitrum.
 * Supports ETH and any ERC-20 token.
 */
export const TokenBalanceAction = (): Action => ({
  name: "token-balance",
  description: "Check ETH or ERC-20 token balance on Arbitrum",
  tools: [tokenBalanceTool],
  skill: tokenBalanceSkill,
})

// SPDX-License-Identifier: Apache-2.0

// Types
export * from "./types.js"

// Level 2, standalone tools
export * from "./tools/index.js"

// Skills, exported separately for advanced use
export * from "./skills/index.js"

// Level 1, Actions (skill + tools bundled)
import { sendEthTool } from "./tools/send-eth.tool.js"
import { tokenBalanceTool } from "./tools/token-balance.tool.js"
import { transferEthSkill } from "./skills/transfer-eth.skill.js"
import type { Action } from "./types.js"

/**
 * @notice Action for transferring ETH on Arbitrum.
 * Bundles send_eth and get_token_balance tools with a skill
 * that guides the agent to check balances before sending.
 */
export const TransferEthAction = (): Action => ({
  name: "transfer-eth",
  description: "Transfer ETH on Arbitrum with balance checks and safety confirmations",
  tools: [sendEthTool, tokenBalanceTool],
  skill: transferEthSkill,
})

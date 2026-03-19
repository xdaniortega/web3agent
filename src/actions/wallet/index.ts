// SPDX-License-Identifier: Apache-2.0

import { sendEthTool, tokenBalanceTool } from "../generic/tools/index.js"
import { transferEthSkill } from "./transfer-eth.skill.js"
import type { Action } from "../types.js"

export { transferEthSkill } from "./transfer-eth.skill.js"
export { tokenBalanceSkill } from "./token-balance.skill.js"

/**
 * @notice Action for transferring ETH.
 * Bundles send_eth and get_token_balance tools with a skill
 * that guides the agent to check balances before sending.
 */
export const TransferEthAction = (): Action => ({
  name: "transfer-eth",
  description: "Transfer ETH with balance checks and safety confirmations",
  tools: [sendEthTool, tokenBalanceTool],
  skill: transferEthSkill,
})

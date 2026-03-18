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
import { httpRequestTool } from "./tools/http-request.tool.js"
import { callContractTool } from "./tools/call-contract.tool.js"
import { fetchContractAbiTool } from "./tools/fetch-contract-abi.tool.js"
import { transferEthSkill } from "./skills/transfer-eth.skill.js"
import { uniswapSwapSkill } from "./skills/uniswap-swap.skill.js"
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

/**
 * @notice Action for swapping tokens via Uniswap Trading API.
 * Bundles http_request (for quotes), call_contract + fetch_contract_abi
 * (for approvals and swaps), and get_token_balance (for balance checks).
 */
export const UniswapSwapAction = (): Action => ({
  name: "uniswap-swap",
  description: "Swap tokens on Uniswap via Trading API (quote, approve, swap)",
  tools: [httpRequestTool, callContractTool, fetchContractAbiTool, tokenBalanceTool],
  skill: uniswapSwapSkill,
})

// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../types.js"

/**
 * @notice Skill context for the token-balance action.
 * Injected into agent system prompt to guide tool usage.
 */
export const tokenBalanceSkill: Skill = {
  name: "token-balance",
  description: "Guidance for checking wallet balances on Arbitrum",
  context: `
    When checking balances on Arbitrum:
    - Always check balance before executing any transfer or swap
    - If no address is specified, use the agent's own wallet address
    - For ETH: call get_token_balance without tokenAddress
    - For ERC-20: call get_token_balance with the token contract address
    - Known Arbitrum One token addresses:
        USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
        USDT: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
        WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
        ARB:  0x912CE59144191C1204E64559FE8253a0e49E6548
    - Format response as: "{amount} {symbol}"
  `,
  examples: [
    {
      user: "What's my ETH balance?",
      thought: "ETH balance requested. No tokenAddress needed.",
      action: "Call get_token_balance with agent wallet address only"
    },
    {
      user: "How much USDC do I have?",
      thought: "USDC is a known token. Use address from known list.",
      action: "Call get_token_balance with agent wallet address and USDC contract address"
    }
  ]
}

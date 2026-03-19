// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../types.js"

/**
 * @notice Skill context for the token-balance action.
 * Injected into agent system prompt to guide tool usage.
 */
export const tokenBalanceSkill: Skill = {
  name: "token-balance",
  description: "Guidance for checking wallet balances",
  context: `
    When checking balances:
    - If no address is specified, omit the address param, the tool defaults to your own wallet
    - For ETH: call get_token_balance without tokenAddress
    - For ERC-20: call get_token_balance with the token contract address
    - Format response as: "{amount} {symbol}"
  `,
  examples: [
    {
      user: "What's my ETH balance?",
      thought: "ETH balance requested. Omit address to use own wallet, no tokenAddress needed.",
      action: "Call get_token_balance with no args"
    },
    {
      user: "How much USDC do I have?",
      thought: "USDC is a known token. Use tokenAddress from known list, omit address for own wallet.",
      action: "Call get_token_balance with USDC contract address only"
    }
  ]
}

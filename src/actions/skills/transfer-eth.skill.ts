// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../types.js"

/**
 * @notice Skill context for the transfer-eth action.
 * Guides the agent through balance checking and ETH transfers.
 */
export const transferEthSkill: Skill = {
  name: "transfer-eth",
  description: "Guidance for transferring ETH safely",
  context: `
    You have two tools: send_eth and get_token_balance.
    Use the network from your system prompt (name and chain ID) for all responses.

    CHECKING BALANCES (get_token_balance):
    - If no address is specified, omit the address param — the tool defaults to your own wallet
    - For ETH: call get_token_balance without tokenAddress
    - For ERC-20: call get_token_balance with the token contract address
    - Format response as: "{amount} {symbol}"

    SENDING ETH (send_eth):
    - When the user provides both a destination address and an amount, check balance and send immediately — do NOT ask for confirmation
    - Only ask for confirmation if the amount exceeds 0.1 ETH
    - Only ask for missing info if the user did not provide address or amount
    - Validate the address starts with 0x and is 42 characters
    - After a successful send, return the block explorer link for the transaction
    - If the transaction fails, return the revert reason clearly — do not retry automatically
  `,
  examples: [
    {
      user: "What's my ETH balance?",
      thought: "ETH balance requested. No tokenAddress needed, omit address to use own wallet.",
      action: "Call get_token_balance with no args"
    },
    {
      user: "Send 0.01 ETH to 0x742d35Cc6634C0532925a3b8D4C9C4A3b5C09d21",
      thought: "Address and amount provided. Check balance, then send directly.",
      action: "Call get_token_balance, then call send_eth"
    },
    {
      user: "Send some ETH to my friend",
      thought: "Missing destination and amount. Cannot call tool yet.",
      action: "Ask user for destination address and amount before calling any tool"
    }
  ]
}

// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../types.js"

/**
 * @notice Skill context for the send-eth action.
 * Injected into agent system prompt to guide tool usage.
 */
export const sendEthSkill: Skill = {
  name: "send-eth",
  description: "Guidance for sending ETH safely on Arbitrum",
  context: `
    When sending ETH on Arbitrum:
    - Always confirm destination address AND amount with the user before calling send_eth
    - Validate the address starts with 0x and is 42 characters
    - If amount exceeds 0.1 ETH, ask for explicit confirmation before proceeding
    - Default network is Arbitrum One (chainId 42161)
    - After a successful send, always return the Arbiscan link:
      https://arbiscan.io/tx/{txHash}
    - If the transaction fails, return the revert reason clearly — do not retry automatically
  `,
  examples: [
    {
      user: "Send 0.01 ETH to 0x742d35Cc6634C0532925a3b8D4C9C4A3b5C09d21",
      thought: "Address and amount provided. Confirm before sending.",
      action: "Confirm with user, then call send_eth tool"
    },
    {
      user: "Send some ETH to my friend",
      thought: "Missing destination and amount. Cannot call tool yet.",
      action: "Ask user for destination address and amount before calling any tool"
    }
  ]
}

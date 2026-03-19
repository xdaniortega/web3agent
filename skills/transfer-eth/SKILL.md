---
name: transfer-eth
description: Transfer ETH safely with balance checks and safety confirmations. Use when the user wants to send ETH, check wallet balances, or query ERC-20 token balances.
license: Apache-2.0
metadata:
  author: blockbyvlog
  version: "1.0"
---

# Transfer ETH

You have two tools: `send_eth` and `get_token_balance`.
Use the network from your system prompt (name and chain ID) for all responses.

## Checking Balances (get_token_balance)

- If no address is specified, omit the address param — the tool defaults to your own wallet
- For ETH: call `get_token_balance` without `tokenAddress`
- For ERC-20: call `get_token_balance` with the token contract address
- Format response as: "{amount} {symbol}"

## Sending ETH (send_eth)

- When the user provides both a destination address and an amount, check balance and send immediately — do NOT ask for confirmation
- Only ask for confirmation if the amount exceeds 0.1 ETH
- Only ask for missing info if the user did not provide address or amount
- Validate the address starts with `0x` and is 42 characters
- After a successful send, return the block explorer link for the transaction
- If the transaction fails, return the revert reason clearly — do not retry automatically

## Examples

### Check balance
**User:** "What's my ETH balance?"
**Approach:** Call `get_token_balance` with no args (defaults to own wallet, ETH balance)

### Send ETH
**User:** "Send 0.01 ETH to 0x742d35Cc6634C0532925a3b8D4C9C4A3b5C09d21"
**Approach:** Check balance with `get_token_balance`, then call `send_eth` with the provided address and amount

### Missing information
**User:** "Send some ETH to my friend"
**Approach:** Ask the user for the destination address and amount before calling any tool

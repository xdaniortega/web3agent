---
name: token-balance
description: Check ETH and ERC-20 token balances for any wallet address. Use when the user wants to check balances, view holdings, or query token amounts.
license: Apache-2.0
allowed-tools: get_token_balance
metadata:
  author: blockbyvlog
  version: "1.0"
---

# Token Balance

You have one tool: `get_token_balance`.

## Usage

- If no address is specified, omit the address param — the tool defaults to your own wallet
- For ETH: call `get_token_balance` without `tokenAddress`
- For ERC-20: call `get_token_balance` with the token contract address
- Format response as: "{amount} {symbol}"

## Examples

### Check own ETH balance
**User:** "What's my ETH balance?"
**Approach:** Call `get_token_balance` with no args (defaults to own wallet, ETH balance)

### Check own ERC-20 balance
**User:** "How much USDC do I have?"
**Approach:** Call `get_token_balance` with USDC contract address, omit address for own wallet

### Check another wallet
**User:** "What's the ETH balance of 0x742d..."
**Approach:** Call `get_token_balance` with the provided address, no tokenAddress

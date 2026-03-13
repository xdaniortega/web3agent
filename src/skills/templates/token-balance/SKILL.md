---
name: token-balance
description: Check ETH and ERC-20 token balances for any address
---

Use this skill to check wallet balances before executing transactions.

- To check ETH balance, pass the wallet address with no tokenAddress.
- To check an ERC-20 token balance, pass both the wallet address and the token contract address.
- Returns a human-readable balance string with the token symbol or "ETH".

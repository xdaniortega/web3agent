---
name: uniswap-swap
description: Execute token swaps on Uniswap V3
---

Use this skill to swap tokens via Uniswap V3's SwapRouter02.

- Requires tokenIn address, tokenOut address, amount (human-readable), and feeTier.
- Common fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%). Default to 3000.
- The skill handles ERC-20 approval automatically.
- amountOutMinimum is set to 0 — this is safe for testnet only.

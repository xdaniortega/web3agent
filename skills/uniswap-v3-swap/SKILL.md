---
name: uniswap-v3-swap
description: Swap tokens on Uniswap V3 via SwapRouter02. Use when the user wants to swap, exchange, or trade tokens using Uniswap V3, or asks for a V3 quote.
license: Apache-2.0
metadata:
  author: blockbyvlog
  version: "1.0"
---

# Uniswap V3 Token Swap

You have these tools: `uniswap_v3_quote`, `uniswap_v3_swap`, `get_token_balance`.

## Two-Step Flow

### Step 1: Get a Quote
Use `uniswap_v3_quote` to get the expected output amount.
- For native ETH, pass "ETH" or the zero address as tokenIn/tokenOut
- The tool resolves ETH to WETH automatically and tries multiple fee tiers
- Show the user the expected output before proceeding

### Step 2: Execute the Swap
Use `uniswap_v3_swap` with the values returned from the quote.
Pass tokenIn, tokenOut, amountIn, amountOut, fee, isNativeIn, isNativeOut directly from the quote result.
- The tool handles ERC-20 approval automatically
- The tool handles ETH wrapping/unwrapping automatically
- Default slippage is 0.5%

## Critical Rules
- **ALWAYS** call `uniswap_v3_quote` first and show the expected output before executing
- If the swap amount exceeds 0.1 ETH equivalent, ask for confirmation
- Use `get_token_balance` to verify balances before and after swaps
- Token amounts in `uniswap_v3_quote` are human-readable (e.g. "0.01", "100")
- Token amounts in `uniswap_v3_swap` are in smallest unit (from quote result)

## Examples

### Simple swap
**User:** "Swap 0.01 ETH for USDC on V3"
**Approach:** 1) `uniswap_v3_quote` with tokenIn='ETH', tokenOut=USDC, amountIn='0.01' 2) Show expected output 3) `uniswap_v3_swap` with quote values

### Quote only
**User:** "How much USDC would I get for 0.05 ETH?"
**Approach:** Call `uniswap_v3_quote` ETH to USDC and show the expected output

### Reverse swap
**User:** "Swap 10 USDC for ETH"
**Approach:** 1) `uniswap_v3_quote` 2) Show expected output 3) `uniswap_v3_swap` with quote values. Tool handles approval and WETH unwrapping.

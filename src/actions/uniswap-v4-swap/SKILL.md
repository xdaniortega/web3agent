---
name: uniswap-v4-swap
description: Swap tokens on Uniswap V4 via UniversalRouter with Permit2. Use when the user wants to swap tokens using Uniswap V4, or asks for a V4 quote.
license: Apache-2.0
allowed-tools: uniswap_v4_quote uniswap_v4_swap get_token_balance
metadata:
  author: blockbyvlog
  version: "1.0"
---

# Uniswap V4 Token Swap

You have these tools: `uniswap_v4_quote`, `uniswap_v4_swap`, `get_token_balance`.

## Key V4 Differences from V3
- V4 uses native ETH directly (address(0)) — no WETH wrapping needed
- V4 uses a singleton PoolManager — all pools in one contract
- V4 uses Permit2 for token approvals (handled automatically by the tool)
- V4 swaps go through the UniversalRouter

## Two-Step Flow

### Step 1: Get a Quote
Use `uniswap_v4_quote` to get the expected output amount.
- For native ETH, pass "ETH" or the zero address as tokenIn/tokenOut
- The tool sorts tokens and builds the PoolKey automatically
- It tries multiple fee tiers if the first one fails
- Show the user the expected output before proceeding

### Step 2: Execute the Swap
Use `uniswap_v4_swap` with the values returned from the quote.
Pass all fields from the quote result directly.
- The tool handles Permit2 approval automatically for ERC-20 tokens
- The tool handles native ETH value automatically
- Default slippage is 0.5%

## Critical Rules
- **ALWAYS** call `uniswap_v4_quote` first and show the expected output before executing
- If the swap amount exceeds 0.1 ETH equivalent, ask for confirmation
- Use `get_token_balance` to verify balances before and after swaps
- Token amounts in `uniswap_v4_quote` are human-readable (e.g. "0.01", "100")
- Token amounts in `uniswap_v4_swap` are in smallest unit (from quote result)
- For ETH, use "ETH" or zero address — NOT the WETH address

## Examples

### Simple swap
**User:** "Swap 0.01 ETH for USDC on V4"
**Approach:** 1) `uniswap_v4_quote` with tokenIn='ETH', tokenOut=USDC, amountIn='0.01'. V4 uses native ETH directly. 2) Show expected output 3) `uniswap_v4_swap` with quote values

### Quote only
**User:** "Quote 100 USDC to ETH on V4"
**Approach:** Call `uniswap_v4_quote` USDC to ETH and show the expected output

### ERC-20 to ERC-20
**User:** "Swap 50 USDC for USDT on V4"
**Approach:** 1) `uniswap_v4_quote` 2) Show expected output 3) `uniswap_v4_swap` with quote values. Tool handles Permit2 approval automatically.

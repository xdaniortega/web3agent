// SPDX-License-Identifier: Apache-2.0

import type { Skill } from "../types.js"

/**
 * @notice Skill context for Uniswap swap integration via Trading API.
 * Guides the agent through the three-step flow: check_approval → quote → swap
 * using http_request (for API calls) and send_eth (for on-chain execution).
 */
export const uniswapSwapSkill: Skill = {
  name: "uniswap-swap",
  description: "Guidance for swapping tokens via the Uniswap Trading API",
  context: `
    You can swap tokens using the Uniswap Trading API.
    You have these tools: http_request, call_contract, fetch_contract_abi, get_token_balance.

    ## Uniswap Trading API

    Base URL: https://trade-api.gateway.uniswap.org/v1
    Authentication is auto-injected via UNISWAP_API_KEY env var.

    ### Three-Step Flow

    ### Step 1: Check Token Approval
    POST https://trade-api.gateway.uniswap.org/v1/check_approval

    Request body:
    {
      "walletAddress": "<agent wallet address>",
      "token": "<tokenIn address>",
      "amount": "<amount in smallest unit>",
      "chainId": 42161
    }

    Response: returns an approval transaction object if approval is needed, or null if already approved.
    If an approval TX is returned, send it on-chain using call_contract BEFORE proceeding.
    SKIP this step entirely when swapping from ETH (native token).

    ### Step 2: Get Quote
    POST https://trade-api.gateway.uniswap.org/v1/quote

    Request body:
    {
      "type": "EXACT_INPUT",
      "swapper": "<agent wallet address>",
      "tokenIn": "<token address, or 0x0000000000000000000000000000000000000000 for native ETH>",
      "tokenOut": "<token address, or 0x0000000000000000000000000000000000000000 for native ETH>",
      "tokenInChainId": 42161,
      "tokenOutChainId": 42161,
      "amount": "<amount in smallest unit>",
      "slippageTolerance": 0.5,
      "routingPreference": "BEST_PRICE"
    }

    For ETH (native), use the zero address: 0x0000000000000000000000000000000000000000
    NEVER use the string "NATIVE" — the API requires a valid 0x address.
    The response shape differs by routing type:
    - CLASSIC routes: quote.output contains the expected output amount
    - UniswapX routes (DUTCH_V2/V3/PRIORITY): use quote.orderInfo.outputs[0].startAmount

    ### Step 3: Execute Swap
    POST https://trade-api.gateway.uniswap.org/v1/swap

    CRITICAL: Spread the quote response directly into the body. Do NOT wrap it in { quote: response }.

    For CLASSIC routes: include both signature and permitData together, OR omit both.
    For UniswapX routes: include signature only, OMIT permitData entirely.
    Never send permitData: null — omit the field instead.

    The response contains a "swap" object with: to, from, data, value, chainId, gasLimit.
    This is a ready-to-sign transaction. Submit it on-chain.

    ## Permit2 Contract (all chains)
    0x000000000022D473030F116dDEE9F6B43aC78BA3

    ## Universal Router (Arbitrum)
    0xa51afafe0263b40edaef0df8781ea9aa03e381a3

    ## Common Arbitrum Token Addresses
    - USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (6 decimals)
    - USDT: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 (6 decimals)
    - WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 (18 decimals)
    - ARB:  0x912CE59144191C1204E64559FE8253a0e49E6548 (18 decimals)
    - DAI:  0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1 (18 decimals)
    - WBTC: 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f (8 decimals)

    ## Token Decimals Reference
    - ETH: 18 decimals (1 ETH = 1000000000000000000 wei)
    - USDC: 6 decimals (1 USDC = 1000000)
    - USDT: 6 decimals (1 USDT = 1000000)
    - DAI: 18 decimals
    - WBTC: 8 decimals
    - ARB: 18 decimals

    ## Supported Chains (mainnet only — testnets are NOT supported)
    - Ethereum: 1
    - Arbitrum: 42161
    - Base: 8453
    - Optimism: 10
    - Polygon: 137

    ## L2 WETH Gotcha
    On L2s (Arbitrum, Base, Optimism), swaps that output ETH often deliver WETH instead.
    After a swap to ETH on L2, check the WETH balance and call withdraw() on the WETH contract if needed.
    Arbitrum WETH: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1

    ## CRITICAL RULES
    - ALWAYS follow the three-step flow: check_approval → quote → swap
    - ALWAYS validate swap.data is not empty or "0x" before broadcasting (quote may have expired)
    - Strip null fields before sending to /swap (API rejects permitData: null)
    - Token amounts must be in the smallest unit (wei for ETH, 6 decimals for USDC/USDT)
    - For ETH swaps, use 0x0000000000000000000000000000000000000000 (zero address), NOT "NATIVE" and NOT the WETH address
    - If the quote fails, tell the user the error, do NOT retry automatically
    - Show the user the expected output amount from the quote before executing
    - If the swap amount exceeds 0.1 ETH equivalent, ask for confirmation before executing
    - Return the block explorer link after a successful swap (https://arbiscan.io/tx/<hash>)
    - Rate limit: ~10 requests/second. Add delays between sequential calls if needed
    - For UniswapX routes, gas is paid by fillers (gasless for the user)
    - For CLASSIC routes, use gasFeeUSD from the response to display gas cost
  `,
  examples: [
    {
      user: "Swap 0.01 ETH for USDC",
      thought: "ETH is native, so skip approval. Get quote with tokenIn=0x0000000000000000000000000000000000000000, tokenOut=USDC address. Amount = 10000000000000000 (0.01 * 10^18).",
      action: "POST /v1/quote, show expected USDC output, then POST /v1/swap and submit TX on-chain",
    },
    {
      user: "How much ARB would I get for 5 USDC?",
      thought: "User wants a quote only, not a swap. 5 USDC = 5000000 (6 decimals).",
      action: "POST /v1/quote and show the expected ARB output amount",
    },
    {
      user: "Swap 100 USDC for DAI",
      thought: "USDC is ERC-20, need to check approval first. Amount = 100000000 (100 * 10^6).",
      action: "POST /v1/check_approval for USDC, approve if needed, POST /v1/quote, POST /v1/swap, submit TX",
    },
  ],
}

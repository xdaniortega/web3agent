---
name: http-request
description: Make HTTP requests to allowed DeFi API endpoints. Use when the user wants to fetch prices, quotes, or data from supported APIs like CoinGecko, DefiLlama, Uniswap Trading API, 1inch, or ParaSwap.
license: Apache-2.0
allowed-tools: http_request
metadata:
  author: blockbyvlog
  version: "1.0"
---

# HTTP Request

You have one tool: `http_request`.

## Allowed Domains
Only requests to approved domains are allowed:
- trade-api.gateway.uniswap.org (Uniswap Trading API)
- api.1inch.dev (1inch)
- api.0x.org (0x)
- api.paraswap.io (ParaSwap)
- api.coingecko.com (CoinGecko)
- pro-api.coinmarketcap.com (CoinMarketCap)
- hermes.pyth.network (Pyth)
- coins.llama.fi / yields.llama.fi (DefiLlama)
- api.brianknows.org (Brian)

Additional domains can be added via the `HTTP_ALLOWLIST` env var (comma-separated).

## API Keys
API keys are injected automatically from environment variables:
- `UNISWAP_API_KEY` — for Uniswap endpoints
- `ONEINCH_API_KEY` — for 1inch endpoints
- `ZEROX_API_KEY` — for 0x endpoints
- `CMC_API_KEY` — for CoinMarketCap endpoints

Do NOT pass API keys in the headers parameter.

## Usage
- Supports GET and POST methods only
- POST bodies must be valid JSON
- Responses are truncated to 4000 characters
- Requests timeout after 15 seconds

## Examples

### Fetch token price
**User:** "What's the current price of ETH?"
**Approach:** Call `http_request` with GET to CoinGecko price endpoint

### Get DeFi yields
**User:** "Show me the top yields on Arbitrum"
**Approach:** Call `http_request` with GET to DefiLlama yields endpoint

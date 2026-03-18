// SPDX-License-Identifier: Apache-2.0

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"

/**
 * Default domain allowlist. Agents can only call these domains.
 * Extend via HTTP_ALLOWLIST env var (comma-separated).
 */
const DEFAULT_ALLOWLIST = [
  "trade-api.gateway.uniswap.org",
  "api.1inch.dev",
  "api.0x.org",
  "api.paraswap.io",
  "api.coingecko.com",
  "pro-api.coinmarketcap.com",
  "hermes.pyth.network",
  "coins.llama.fi",
  "yields.llama.fi",
  "api.brianknows.org",
]

/** Max response body size in characters to avoid context overflow. */
const MAX_RESPONSE_LENGTH = 4000

function getAllowlist(): string[] {
  const custom = process.env.HTTP_ALLOWLIST
  if (custom) {
    return [
      ...DEFAULT_ALLOWLIST,
      ...custom.split(",").map((d) => d.trim()).filter(Boolean),
    ]
  }
  return DEFAULT_ALLOWLIST
}

function isDomainAllowed(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return getAllowlist().some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

/**
 * @notice Generic HTTP request tool with domain allowlisting.
 * Supports GET and POST. Headers with secrets (API keys) should be
 * injected via env vars, not passed by the agent.
 */
export const httpRequestTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "http_request",
  description:
    "Make an HTTP request to an allowed API endpoint. " +
    "Supports GET and POST methods. Use this to fetch quotes, prices, or any data from allowed APIs. " +
    "Allowed domains include: Uniswap Trading API, 1inch, 0x, ParaSwap, CoinGecko, DefiLlama, Pyth, Brian. " +
    "Extend the allowlist via HTTP_ALLOWLIST env var. " +
    "API keys are injected automatically from env vars (UNISWAP_API_KEY, ONEINCH_API_KEY, etc.), do NOT pass them in headers.",
  schema: z.object({
    url: z.string().describe("Full URL including query parameters (e.g. https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd)"),
    method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method. Only GET and POST are allowed."),
    body: z.string().optional().describe("JSON request body for POST requests. Must be valid JSON."),
    headers: z.record(z.string()).optional().describe("Additional headers. Do NOT include API keys here, they are injected automatically."),
  }),
  func: async ({ url, method, body, headers }): Promise<string> => {
    try {
      // Domain allowlist check
      if (!isDomainAllowed(url)) {
        const allowed = getAllowlist().join(", ")
        return `Error: Domain not allowed. Allowed domains: ${allowed}. To add a domain, set the HTTP_ALLOWLIST env var.`
      }

      // Build headers, inject API keys from env vars
      const requestHeaders: Record<string, string> = {
        "Accept": "application/json",
        ...headers,
      }

      // Auto-inject API keys based on domain
      const hostname = new URL(url).hostname
      if (hostname.includes("uniswap") && process.env.UNISWAP_API_KEY) {
        requestHeaders["x-api-key"] = process.env.UNISWAP_API_KEY
        requestHeaders["x-universal-router-version"] = "2.0"
      }
      if (hostname.includes("1inch") && process.env.ONEINCH_API_KEY) {
        requestHeaders["Authorization"] = `Bearer ${process.env.ONEINCH_API_KEY}`
      }
      if (hostname.includes("0x.org") && process.env.ZEROX_API_KEY) {
        requestHeaders["0x-api-key"] = process.env.ZEROX_API_KEY
      }
      if (hostname.includes("coinmarketcap") && process.env.CMC_API_KEY) {
        requestHeaders["X-CMC_PRO_API_KEY"] = process.env.CMC_API_KEY
      }

      // Build request options
      const options: RequestInit = {
        method,
        headers: requestHeaders,
        signal: AbortSignal.timeout(15000),
      }

      if (method === "POST" && body) {
        requestHeaders["Content-Type"] = "application/json"
        options.body = body
      }

      const response = await fetch(url, options)
      const text = await response.text()

      // Truncate large responses
      const truncated = text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH) + `\n...[truncated, ${text.length} total chars]`
        : text

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}\n${truncated}`
      }

      return truncated
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("abort") || message.includes("timeout")) {
        return "Error: Request timed out after 15 seconds"
      }
      return `Error: ${message}`
    }
  },
})

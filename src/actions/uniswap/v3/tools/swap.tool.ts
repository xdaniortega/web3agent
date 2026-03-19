// SPDX-License-Identifier: Apache-2.0

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatUnits,
  parseUnits,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { getRpcUrl, getChainId } from "../../../../core/config.js"
import { TOKEN_CONFIG, resolveToken } from "../../shared/tokens.js"

/**
 * @notice Per-chain Uniswap V3 contract addresses.
 */
const V3_CONTRACTS: Record<number, {
  swapRouter: `0x${string}`
  quoterV2: `0x${string}`
}> = {
  42161: {
    swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  },
  421614: {
    swapRouter: "0x101F443B4d1b059569D643917553c771E1b9663E",
    quoterV2: "0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B",
  },
}

/** Minimal ABI for QuoterV2.quoteExactInputSingle */
const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const

/** Minimal ABI for SwapRouter02 */
const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "unwrapWETH9",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
] as const

/** Minimal ERC-20 ABI */
const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

function getV3Config() {
  const chainId = getChainId()
  const contracts = V3_CONTRACTS[chainId]
  const tokens = TOKEN_CONFIG[chainId]
  if (!contracts || !tokens) throw new Error(`Uniswap V3 not configured for chain ${chainId}`)
  return { ...contracts, ...tokens }
}

function buildClients() {
  const rpcUrl = getRpcUrl()
  const chain = defineChain({
    id: getChainId(),
    name: "Arbitrum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  const privateKey = process.env.AGENT_PRIVATE_KEY
  if (!privateKey) throw new Error("AGENT_PRIVATE_KEY not set")

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  return { publicClient, walletClient, account }
}

/**
 * @notice Fetches a Uniswap V3 quote via QuoterV2.quoteExactInputSingle.
 * Tries multiple fee tiers on failure.
 */
export const uniswapV3QuoteTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "uniswap_v3_quote",
  description:
    "Get a Uniswap V3 quote for swapping tokens. Returns the expected output amount. " +
    "Use 'ETH' or the zero address for native ETH. Read-only, no gas spent.",
  schema: z.object({
    tokenIn: z.string().describe("Input token address, or 'ETH' / zero address for native ETH"),
    tokenOut: z.string().describe("Output token address, or 'ETH' / zero address for native ETH"),
    amountIn: z.string().describe("Amount in human-readable form (e.g. '0.01', '100')"),
    tokenInDecimals: z.number().default(18).describe("Decimals of input token (18 for ETH, 6 for USDC)"),
    tokenOutDecimals: z.number().default(18).describe("Decimals of output token"),
    fee: z.number().default(3000).describe("Pool fee tier: 500 (0.05%), 3000 (0.3%), or 10000 (1%)"),
  }),
  func: async ({ tokenIn, tokenOut, amountIn, tokenInDecimals, tokenOutDecimals, fee }): Promise<string> => {
    try {
      const config = getV3Config()
      const { publicClient } = buildClients()

      const resolvedIn = resolveToken(tokenIn, config.weth)
      const resolvedOut = resolveToken(tokenOut, config.weth)
      const amountInWei = parseUnits(amountIn, tokenInDecimals)

      const feeTiers = [fee, ...[500, 3000, 10000].filter((f) => f !== fee)]

      for (const currentFee of feeTiers) {
        try {
          const result = await publicClient.simulateContract({
            address: config.quoterV2,
            abi: QUOTER_ABI,
            functionName: "quoteExactInputSingle",
            args: [{
              tokenIn: resolvedIn.address,
              tokenOut: resolvedOut.address,
              amountIn: amountInWei,
              fee: currentFee,
              sqrtPriceLimitX96: 0n,
            }],
          })

          const [amountOut] = result.result as unknown as [bigint, bigint, number, bigint]
          const formatted = formatUnits(amountOut, tokenOutDecimals)

          return JSON.stringify({
            amountOut: amountOut.toString(),
            amountOutFormatted: formatted,
            fee: currentFee,
            tokenIn: resolvedIn.address,
            tokenOut: resolvedOut.address,
            amountIn: amountInWei.toString(),
            isNativeIn: resolvedIn.isNative,
            isNativeOut: resolvedOut.isNative,
          })
        } catch {
          if (currentFee === feeTiers[feeTiers.length - 1]) {
            throw new Error(`No V3 pool found (tried fee tiers ${feeTiers.join(", ")})`)
          }
        }
      }

      return "Error: No pool found"
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message.length > 300 ? message.slice(0, 300) + "..." : message}`
    }
  },
})

/**
 * @notice Executes a Uniswap V3 swap via SwapRouter02.exactInputSingle.
 * Handles ERC-20 approval, native ETH wrapping, and WETH unwrapping.
 */
export const uniswapV3SwapTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "uniswap_v3_swap",
  description:
    "Execute a Uniswap V3 swap. ALWAYS call uniswap_v3_quote first. " +
    "Handles token approval, ETH wrapping, and WETH unwrapping automatically.",
  schema: z.object({
    tokenIn: z.string().describe("Input token address (WETH address for ETH, from quote)"),
    tokenOut: z.string().describe("Output token address (WETH address for ETH, from quote)"),
    amountIn: z.string().describe("Amount in smallest unit (wei), from quote"),
    amountOut: z.string().describe("Expected output in smallest unit, from quote"),
    fee: z.number().describe("Pool fee tier from quote"),
    isNativeIn: z.boolean().describe("True if swapping native ETH (from quote)"),
    isNativeOut: z.boolean().describe("True if swapping to native ETH (from quote)"),
    slippage: z.number().default(0.5).describe("Slippage tolerance in percent (default 0.5%)"),
  }),
  func: async ({ tokenIn, tokenOut, amountIn, amountOut, fee, isNativeIn, isNativeOut, slippage }): Promise<string> => {
    try {
      const config = getV3Config()
      const { publicClient, walletClient, account } = buildClients()

      const amountInBig = BigInt(amountIn)
      const amountOutBig = BigInt(amountOut)
      const slippageBps = BigInt(Math.floor((1 - slippage / 100) * 10000))
      const amountOutMinimum = amountOutBig * slippageBps / 10000n

      // Approve if ERC-20 input
      if (!isNativeIn) {
        const allowance = await publicClient.readContract({
          address: tokenIn as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account.address, config.swapRouter],
        })

        if ((allowance as bigint) < amountInBig) {
          const approveTx = await walletClient.writeContract({
            address: tokenIn as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [config.swapRouter, amountInBig],
          })
          await publicClient.waitForTransactionReceipt({ hash: approveTx })
        }
      }

      // Execute swap
      const recipient = isNativeOut ? config.swapRouter : account.address

      const swapTx = await walletClient.writeContract({
        address: config.swapRouter,
        abi: SWAP_ROUTER_ABI,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          fee,
          recipient,
          amountIn: amountInBig,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        }],
        value: isNativeIn ? amountInBig : 0n,
      })

      // Unwrap WETH if output is native ETH
      if (isNativeOut) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx })
        if (receipt.status === "success") {
          const unwrapTx = await walletClient.writeContract({
            address: config.swapRouter,
            abi: SWAP_ROUTER_ABI,
            functionName: "unwrapWETH9",
            args: [0n, account.address],
          })
          await publicClient.waitForTransactionReceipt({ hash: unwrapTx })
        }
      }

      return `Swap successful! TX: ${config.explorer}/${swapTx}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message.length > 300 ? message.slice(0, 300) + "..." : message}`
    }
  },
})

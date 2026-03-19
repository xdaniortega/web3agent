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
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { getRpcUrl, getChainId } from "../../../../core/config.js"
import { TOKEN_CONFIG, ZERO_ADDRESS, sortTokens } from "../../shared/tokens.js"

/**
 * @notice Per-chain Uniswap V4 contract addresses.
 */
const V4_CONTRACTS: Record<number, {
  poolManager: `0x${string}`
  universalRouter: `0x${string}`
  quoter: `0x${string}`
  permit2: `0x${string}`
}> = {
  42161: {
    poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
    universalRouter: "0xa51afafe0263b40edaef0df8781ea9aa03e381a3",
    quoter: "0x3972c00f7ed4885e145823eb7c655375d275a1c5",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
  421614: {
    poolManager: "0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317",
    universalRouter: "0xefd1d4bd4cf1e86da286bb4cb1b8bced9c10ba47",
    quoter: "0x7de51022d70a725b508085468052e25e22b5c4c9",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
}

/** V4Quoter ABI — quoteExactInputSingle (simulated via eth_call) */
const V4_QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const

/** UniversalRouter.execute ABI */
const UNIVERSAL_ROUTER_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const

/** Permit2 approve ABI */
const PERMIT2_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const

/** ERC-20 approve for Permit2 */
const ERC20_APPROVE_ABI = [
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

/** UniversalRouter command bytes */
const COMMANDS = {
  V4_SWAP: 0x10,
} as const

/** V4Router action bytes */
const ACTIONS = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f,
} as const

/** Common tick spacings for each fee tier */
const FEE_TO_TICK_SPACING: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
}

function getV4Config() {
  const chainId = getChainId()
  const contracts = V4_CONTRACTS[chainId]
  const tokens = TOKEN_CONFIG[chainId]
  if (!contracts || !tokens) throw new Error(`Uniswap V4 not configured for chain ${chainId}`)
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
 * @notice Fetches a Uniswap V4 quote via V4Quoter.quoteExactInputSingle.
 * Uses eth_call simulation. Tries multiple fee/tickSpacing combos.
 */
export const uniswapV4QuoteTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "uniswap_v4_quote",
  description:
    "Get a Uniswap V4 quote for swapping tokens. Returns the expected output amount. " +
    "Use 'ETH' or the zero address for native ETH. " +
    "V4 uses native ETH directly (no WETH wrapping needed). Read-only, no gas spent.",
  schema: z.object({
    tokenIn: z.string().describe("Input token address, or 'ETH' / zero address for native ETH"),
    tokenOut: z.string().describe("Output token address, or 'ETH' / zero address for native ETH"),
    amountIn: z.string().describe("Amount in human-readable form (e.g. '0.01', '100')"),
    tokenInDecimals: z.number().default(18).describe("Decimals of input token (18 for ETH, 6 for USDC)"),
    tokenOutDecimals: z.number().default(18).describe("Decimals of output token"),
    fee: z.number().default(3000).describe("Pool fee tier: 100, 500, 3000, or 10000"),
  }),
  func: async ({ tokenIn, tokenOut, amountIn, tokenInDecimals, tokenOutDecimals, fee }): Promise<string> => {
    try {
      const config = getV4Config()
      const { publicClient } = buildClients()

      // V4 uses address(0) for native ETH — no WETH resolution
      const inLower = tokenIn.toLowerCase()
      const isNativeIn = inLower === "eth" || inLower === ZERO_ADDRESS
      const resolvedIn = isNativeIn ? ZERO_ADDRESS : tokenIn as `0x${string}`

      const outLower = tokenOut.toLowerCase()
      const isNativeOut = outLower === "eth" || outLower === ZERO_ADDRESS
      const resolvedOut = isNativeOut ? ZERO_ADDRESS : tokenOut as `0x${string}`

      const amountInWei = parseUnits(amountIn, tokenInDecimals)

      // Sort tokens for PoolKey (currency0 < currency1)
      const { currency0, currency1, zeroForOne } = sortTokens(
        resolvedIn, resolvedOut, isNativeIn, isNativeOut,
      )

      const feeTiers = [fee, ...[100, 500, 3000, 10000].filter((f) => f !== fee)]

      for (const currentFee of feeTiers) {
        const tickSpacing = FEE_TO_TICK_SPACING[currentFee] ?? 60

        try {
          const result = await publicClient.simulateContract({
            address: config.quoter,
            abi: V4_QUOTER_ABI,
            functionName: "quoteExactInputSingle",
            args: [{
              poolKey: {
                currency0,
                currency1,
                fee: currentFee,
                tickSpacing,
                hooks: ZERO_ADDRESS,
              },
              zeroForOne,
              exactAmount: BigInt(amountInWei) as unknown as bigint & { __brand: "uint128" },
              hookData: "0x" as `0x${string}`,
            }],
          })

          const [amountOut] = result.result as unknown as [bigint, bigint]
          const formatted = formatUnits(amountOut, tokenOutDecimals)

          return JSON.stringify({
            amountOut: amountOut.toString(),
            amountOutFormatted: formatted,
            fee: currentFee,
            tickSpacing,
            currency0,
            currency1,
            zeroForOne,
            tokenIn: resolvedIn,
            tokenOut: resolvedOut,
            amountIn: amountInWei.toString(),
            isNativeIn,
            isNativeOut,
          })
        } catch {
          if (currentFee === feeTiers[feeTiers.length - 1]) {
            throw new Error(`No V4 pool found (tried fee tiers ${feeTiers.join(", ")})`)
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
 * @notice Executes a Uniswap V4 swap via UniversalRouter.execute().
 * Handles Permit2 approval for ERC-20 tokens and native ETH value.
 */
export const uniswapV4SwapTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "uniswap_v4_swap",
  description:
    "Execute a Uniswap V4 swap. ALWAYS call uniswap_v4_quote first. " +
    "Handles Permit2 token approval and native ETH automatically. " +
    "Pass the quote result values directly.",
  schema: z.object({
    currency0: z.string().describe("Sorted lower token address from quote"),
    currency1: z.string().describe("Sorted higher token address from quote"),
    fee: z.number().describe("Pool fee tier from quote"),
    tickSpacing: z.number().describe("Tick spacing from quote"),
    zeroForOne: z.boolean().describe("Swap direction from quote"),
    amountIn: z.string().describe("Amount in smallest unit (wei), from quote"),
    amountOut: z.string().describe("Expected output in smallest unit, from quote"),
    isNativeIn: z.boolean().describe("True if input is native ETH (from quote)"),
    isNativeOut: z.boolean().describe("True if output is native ETH (from quote)"),
    tokenIn: z.string().describe("Original tokenIn address from quote"),
    slippage: z.number().default(0.5).describe("Slippage tolerance in percent (default 0.5%)"),
  }),
  func: async ({ currency0, currency1, fee, tickSpacing, zeroForOne, amountIn, amountOut, isNativeIn, isNativeOut, tokenIn, slippage }): Promise<string> => {
    try {
      const config = getV4Config()
      const { publicClient, walletClient, account } = buildClients()

      const amountInBig = BigInt(amountIn)
      const amountOutBig = BigInt(amountOut)
      const slippageBps = BigInt(Math.floor((1 - slippage / 100) * 10000))
      const amountOutMinimum = amountOutBig * slippageBps / 10000n

      // Approve ERC-20 → Permit2 → UniversalRouter (skip for native ETH)
      if (!isNativeIn) {
        // Step 1: ERC-20 approve Permit2
        const erc20Allowance = await publicClient.readContract({
          address: tokenIn as `0x${string}`,
          abi: ERC20_APPROVE_ABI,
          functionName: "allowance",
          args: [account.address, config.permit2],
        }) as bigint

        if (erc20Allowance < amountInBig) {
          const approveTx = await walletClient.writeContract({
            address: tokenIn as `0x${string}`,
            abi: ERC20_APPROVE_ABI,
            functionName: "approve",
            args: [config.permit2, amountInBig],
          })
          await publicClient.waitForTransactionReceipt({ hash: approveTx })
        }

        // Step 2: Permit2 approve UniversalRouter
        const permit2Result = await publicClient.readContract({
          address: config.permit2,
          abi: PERMIT2_ABI,
          functionName: "allowance",
          args: [account.address, tokenIn as `0x${string}`, config.universalRouter],
        }) as unknown as [bigint, number, number]
        const permit2Amount = permit2Result[0]

        if (permit2Amount < amountInBig) {
          const maxUint160 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
          const expiration = Math.floor(Date.now() / 1000) + 86400 * 30
          const permit2Tx = await walletClient.writeContract({
            address: config.permit2,
            abi: PERMIT2_ABI,
            functionName: "approve",
            args: [
              tokenIn as `0x${string}`,
              config.universalRouter,
              maxUint160 as any,
              expiration as any,
            ],
          })
          await publicClient.waitForTransactionReceipt({ hash: permit2Tx })
        }
      }

      // Build UniversalRouter.execute() calldata
      // Command: V4_SWAP (0x10)
      const commands = encodePacked(["uint8"], [COMMANDS.V4_SWAP])

      // Actions: SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
      const actions = encodePacked(
        ["uint8", "uint8", "uint8"],
        [ACTIONS.SWAP_EXACT_IN_SINGLE, ACTIONS.SETTLE_ALL, ACTIONS.TAKE_ALL],
      )

      // Determine settle/take currencies
      const settleCurrency = zeroForOne ? currency0 : currency1
      const takeCurrency = zeroForOne ? currency1 : currency0

      // Encode params for each action
      // 1. SWAP_EXACT_IN_SINGLE params
      const swapParams = encodeAbiParameters(
        parseAbiParameters("(address,address,uint24,int24,address) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData"),
        [
          [
            currency0 as `0x${string}`,
            currency1 as `0x${string}`,
            fee,
            tickSpacing,
            ZERO_ADDRESS,
          ],
          zeroForOne,
          amountInBig as unknown as bigint & { __brand: "uint128" },
          amountOutMinimum as unknown as bigint & { __brand: "uint128" },
          "0x" as `0x${string}`,
        ],
      )

      // 2. SETTLE_ALL params (currency, maxAmount)
      const settleParams = encodeAbiParameters(
        parseAbiParameters("address currency, uint256 maxAmount"),
        [settleCurrency as `0x${string}`, amountInBig],
      )

      // 3. TAKE_ALL params (currency, minAmount)
      const takeParams = encodeAbiParameters(
        parseAbiParameters("address currency, uint256 minAmount"),
        [takeCurrency as `0x${string}`, amountOutMinimum],
      )

      // Encode the V4_SWAP input: (actions, params[])
      const v4SwapInput = encodeAbiParameters(
        parseAbiParameters("bytes actions, bytes[] params"),
        [actions, [swapParams, settleParams, takeParams]],
      )

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 min

      const swapTx = await walletClient.writeContract({
        address: config.universalRouter,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [commands, [v4SwapInput], deadline],
        value: isNativeIn ? amountInBig : 0n,
      })

      return `Swap successful! TX: ${config.explorer}/${swapTx}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message.length > 300 ? message.slice(0, 300) + "..." : message}`
    }
  },
})

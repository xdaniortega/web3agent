// SPDX-License-Identifier: Apache-2.0

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatUnits,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { AbiFunction } from "viem"
import { getRpcUrl, getChainId } from "../../core/config.js"
import { fetchAbi } from "./fetch-contract-abi.tool.js"

function coerceArgs(values: unknown[], inputs: AbiFunction["inputs"]): unknown[] {
  return values.map((val, i) => {
    const abiType = inputs[i]?.type ?? ""
    if (/^u?int\d*$/.test(abiType)) return BigInt(String(val))
    return val
  })
}

function formatResult(result: unknown, fn: AbiFunction): string {
  if (typeof result === "bigint") {
    const outputType = fn.outputs[0]?.type ?? ""
    if (outputType === "uint8" && fn.name === "decimals") return String(result)
    if (outputType === "uint256") {
      return `${result.toString()} (raw) / ${formatUnits(result, 18)} (18 dec)`
    }
    return result.toString()
  }
  if (typeof result === "object" && result !== null) {
    return JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  }
  return String(result)
}

/**
 * @notice Calls a function on a verified contract. Fetches the ABI from the block explorer,
 * then executes a read (view/pure) or write (nonpayable/payable) call via viem.
 */
export const callContractTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "call_contract",
  description:
    "Call a function on a verified contract. Fetches the ABI automatically. " +
    "For view/pure functions returns the result. For state-changing functions returns the tx hash. " +
    "Use fetch_contract_abi first to see available functions.",
  schema: z.object({
    address: z.string().describe("Contract address (0x...)"),
    functionName: z.string().describe("Exact function name to call"),
    args: z.string().optional().describe(
      "JSON array of arguments e.g. '[\"0x...\", \"100\"]'. Omit for functions with no arguments."
    ),
  }),
  func: async ({ address, functionName, args }): Promise<string> => {
    try {
      const abi = await fetchAbi(address)
      const fn = abi.find(
        (item): item is AbiFunction =>
          item.type === "function" && item.name === functionName
      )

      if (!fn) {
        return `Error: Function "${functionName}" not found in ABI for ${address}`
      }

      const rawArgs: unknown[] = args ? JSON.parse(args) as unknown[] : []
      if (rawArgs.length !== fn.inputs.length) {
        const expected = fn.inputs.map((i) => `${i.type} ${i.name || "_"}`).join(", ")
        return `Error: ${functionName} expects ${fn.inputs.length} args (${expected}), got ${rawArgs.length}`
      }

      const coerced = coerceArgs(rawArgs, fn.inputs)
      const rpcUrl = getRpcUrl()
      const chain = defineChain({
        id: getChainId(),
        name: "Arbitrum",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      })

      // Read call (view / pure)
      if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
        const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
        const result = await publicClient.readContract({
          address: address as `0x${string}`,
          abi: [fn],
          functionName,
          args: coerced,
        })

        return formatResult(result, fn)
      }

      // Write call (nonpayable / payable)
      const privateKey = process.env.AGENT_PRIVATE_KEY
      if (!privateKey) {
        return "Error: AGENT_PRIVATE_KEY environment variable is not set, cannot execute write calls"
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`)
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      })

      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: [fn],
        functionName,
        args: coerced,
      })

      return hash
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const short = message.length > 300 ? message.slice(0, 300) + "..." : message
      return `Error: ${short}`
    }
  },
})

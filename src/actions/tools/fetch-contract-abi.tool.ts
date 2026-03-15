// SPDX-License-Identifier: Apache-2.0

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import type { Abi, AbiFunction } from "viem"
import { getChainId } from "../../core/config.js"

const EXPLORER_API: Record<number, string> = {
  42161: "https://api.arbiscan.io/api",
  421614: "https://api-sepolia.arbiscan.io/api",
}

function getExplorerApiUrl(): string {
  return EXPLORER_API[getChainId()] ?? EXPLORER_API[42161]
}

export async function fetchAbi(address: string): Promise<Abi> {
  const apiUrl = getExplorerApiUrl()
  const apiKey = process.env.ARBISCAN_API_KEY ?? ""
  const url = `${apiUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`
  const res = await fetch(url)
  const data = (await res.json()) as { status: string; result: string }
  if (data.status !== "1") {
    throw new Error(data.result || "Failed to fetch ABI — contract may not be verified")
  }
  return JSON.parse(data.result) as Abi
}

function formatFunctionSig(fn: AbiFunction): string {
  const inputs = fn.inputs.map((i) => `${i.type} ${i.name || "_"}`).join(", ")
  const outputs = fn.outputs.map((o) => o.type).join(", ")
  const ret = outputs ? ` → ${outputs}` : ""
  return `${fn.name}(${inputs})${ret} [${fn.stateMutability}]`
}

/**
 * @notice Fetches a verified contract's ABI from the block explorer and returns its callable functions.
 */
export const fetchContractAbiTool: DynamicStructuredTool = new DynamicStructuredTool({
  name: "fetch_contract_abi",
  description:
    "Fetch the ABI of a verified contract from the block explorer. " +
    "Returns a numbered list of callable functions with their signatures. " +
    "Use this to discover what a contract can do before calling call_contract.",
  schema: z.object({
    address: z.string().describe("Contract address (0x...)"),
  }),
  func: async ({ address }): Promise<string> => {
    try {
      const abi = await fetchAbi(address)
      const functions = abi.filter(
        (item): item is AbiFunction => item.type === "function"
      )

      if (functions.length === 0) {
        return `Contract ${address} has no callable functions in its ABI.`
      }

      const lines = functions.map((fn, i) => `${i + 1}. ${formatFunctionSig(fn)}`)
      return `Contract ${address} — ${functions.length} functions:\n\n${lines.join("\n")}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  },
})

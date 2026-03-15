// SPDX-License-Identifier: Apache-2.0

import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import type { Abi, AbiFunction } from "viem"

/**
 * @notice Builds LangChain tools from any contract ABI.
 * Enables agents to call arbitrary onchain functions without hardcoded logic.
 * @param params.address - Contract address
 * @param params.abi - Contract ABI
 * @param params.allowlist - Optional list of function names to expose. If empty, exposes all functions.
 * @returns Array of DynamicStructuredTool, one per ABI function
 */
export function buildToolsFromABI(params: {
  address: `0x${string}`
  abi: Abi
  allowlist?: string[]
}): DynamicStructuredTool[] {
  const functions = params.abi.filter(
    (item): item is AbiFunction =>
      item.type === "function" &&
      (!params.allowlist || params.allowlist.includes(item.name))
  )

  return functions.map((fn) => {
    // TODO: build zod schema dynamically from fn.inputs
    // TODO: call contract using viem readContract / writeContract based on fn.stateMutability
    // TODO: handle tuple inputs, array inputs
    return new DynamicStructuredTool({
      name: fn.name,
      description: `Call ${fn.name} on contract ${params.address}`,
      schema: z.object({}),
      func: async (): Promise<string> => {
        // TODO: implement
        return `TODO: ${fn.name} not yet implemented`
      },
    })
  })
}

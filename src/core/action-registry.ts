// SPDX-License-Identifier: Apache-2.0

/**
 * Centralized catalog of available actions and tools.
 * Used by the create-agent CLI for interactive selection.
 * @module action-registry
 */

import type { DynamicStructuredTool } from "@langchain/core/tools"
import type { Action } from "../actions/types.js"
import {
  TransferEthAction,
  UniswapSwapAction,
  sendEthTool,
  tokenBalanceTool,
  fetchContractAbiTool,
  callContractTool,
  httpRequestTool,
} from "../actions/index.js"

/** @notice Describes an available action for the selection menu. */
export interface ActionEntry {
  name: string
  description: string
  toolNames: string[]
  skillName: string
  factory: () => Action
}

/** @notice Describes an available standalone tool for the selection menu. */
export interface ToolEntry {
  name: string
  description: string
}

/** @notice Registry of all available actions (Level 1). */
export const ACTION_REGISTRY: ActionEntry[] = [
  {
    name: "transfer-eth",
    description: "Transfer ETH on Arbitrum with balance checks and safety confirmations",
    toolNames: ["send_eth", "get_token_balance"],
    skillName: "transfer-eth",
    factory: TransferEthAction,
  },
  {
    name: "uniswap-swap",
    description: "Swap tokens on Uniswap via Trading API (quote, approve, swap)",
    toolNames: ["http_request", "call_contract", "fetch_contract_abi", "get_token_balance"],
    skillName: "uniswap-swap",
    factory: UniswapSwapAction,
  },
]

/** @notice Registry of all available standalone tools (Level 2). */
export const TOOL_REGISTRY: ToolEntry[] = [
  {
    name: "send_eth",
    description: "Send ETH from the agent wallet to a destination address",
  },
  {
    name: "get_token_balance",
    description: "Check ETH or ERC-20 token balance of a wallet address",
  },
  {
    name: "fetch_contract_abi",
    description: "Fetch a verified contract's ABI from the block explorer (experimental)",
  },
  {
    name: "call_contract",
    description: "Call any function on a verified contract (experimental)",
  },
  {
    name: "http_request",
    description: "Make HTTP requests to allowed API endpoints (Uniswap, 1inch, CoinGecko, etc.)",
  },
]

const TOOL_INSTANCES: Record<string, DynamicStructuredTool> = {
  send_eth: sendEthTool,
  get_token_balance: tokenBalanceTool,
  fetch_contract_abi: fetchContractAbiTool,
  call_contract: callContractTool,
  http_request: httpRequestTool,
}

/** @notice Look up an action entry by name. */
export function getActionByName(name: string): ActionEntry | undefined {
  return ACTION_REGISTRY.find((a) => a.name === name)
}

/** @notice Look up a tool entry by name. */
export function getToolByName(name: string): ToolEntry | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name)
}

/** @notice Get a standalone tool instance by name. */
export function getStandaloneToolInstance(name: string): DynamicStructuredTool | undefined {
  return TOOL_INSTANCES[name]
}

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
  UniswapV3SwapAction,
  UniswapV4SwapAction,
  sendEthTool,
  tokenBalanceTool,
  fetchContractAbiTool,
  callContractTool,
  httpRequestTool,
  uniswapV3QuoteTool,
  uniswapV3SwapTool,
  uniswapV4QuoteTool,
  uniswapV4SwapTool,
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
    description: "Transfer ETH with balance checks and safety confirmations",
    toolNames: ["send_eth", "get_token_balance"],
    skillName: "transfer-eth",
    factory: TransferEthAction,
  },
  {
    name: "uniswap-v3-swap",
    description: "Swap tokens on Uniswap V3 via SwapRouter02 (quote, approve, swap)",
    toolNames: ["uniswap_v3_quote", "uniswap_v3_swap", "get_token_balance"],
    skillName: "uniswap-v3-swap",
    factory: UniswapV3SwapAction,
  },
  {
    name: "uniswap-v4-swap",
    description: "Swap tokens on Uniswap V4 via UniversalRouter (quote, Permit2 approve, swap)",
    toolNames: ["uniswap_v4_quote", "uniswap_v4_swap", "get_token_balance"],
    skillName: "uniswap-v4-swap",
    factory: UniswapV4SwapAction,
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
    description: "Fetch a verified contract's ABI from the block explorer",
  },
  {
    name: "call_contract",
    description: "Call any function on a verified contract",
  },
  {
    name: "http_request",
    description: "Make HTTP requests to allowed API endpoints (1inch, CoinGecko, etc.)",
  },
  {
    name: "uniswap_v3_quote",
    description: "Get a Uniswap V3 swap quote (expected output amount)",
  },
  {
    name: "uniswap_v3_swap",
    description: "Execute a Uniswap V3 token swap on-chain",
  },
  {
    name: "uniswap_v4_quote",
    description: "Get a Uniswap V4 swap quote (expected output amount)",
  },
  {
    name: "uniswap_v4_swap",
    description: "Execute a Uniswap V4 token swap on-chain",
  },
]

const TOOL_INSTANCES: Record<string, DynamicStructuredTool> = {
  send_eth: sendEthTool,
  get_token_balance: tokenBalanceTool,
  fetch_contract_abi: fetchContractAbiTool,
  call_contract: callContractTool,
  http_request: httpRequestTool,
  uniswap_v3_quote: uniswapV3QuoteTool,
  uniswap_v3_swap: uniswapV3SwapTool,
  uniswap_v4_quote: uniswapV4QuoteTool,
  uniswap_v4_swap: uniswapV4SwapTool,
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

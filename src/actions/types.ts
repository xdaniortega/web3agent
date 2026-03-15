// SPDX-License-Identifier: Apache-2.0

import type { DynamicStructuredTool } from "@langchain/core/tools"

/**
 * @notice Prompt context injected into the agent system prompt.
 * Defines when and how to use tools, no execution capability.
 */
export interface Skill {
  name: string
  description: string
  /** Injected verbatim into the agent system prompt */
  context: string
  examples?: Array<{
    user: string
    thought: string
    action: string
  }>
}

/**
 * @notice Composable unit combining tools + skill.
 * Level 1 of the actions architecture.
 */
export interface Action {
  name: string
  description: string
  tools: DynamicStructuredTool[]
  skill: Skill
}

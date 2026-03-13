/**
 * Agent orchestration layer using LangChain.js with Claude.
 *
 * This module creates and runs autonomous agents that can execute onchain
 * actions via attached skills (LangChain tools).
 *
 * @module orchestrator
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { resolveSkills } from "./skills/index.js";
import type { RunAgentOptions, AgentRunResult } from "./types.js";

/**
 * Default Claude model used by the orchestrator.
 * Uses Claude Sonnet (latest available).
 */
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Runs an autonomous agent with the specified task and skills.
 *
 * The agent uses Claude Sonnet via LangChain.js and can execute onchain
 * actions through attached skills (DynamicStructuredTool instances).
 *
 * Streaming is disabled by default. To enable streaming output, set
 * `options.streaming` to `true`.
 *
 * Human-in-the-loop is disabled by default. To enable it, use LangGraph's
 * interrupt mechanism:
 *   1. Import `interrupt` from `@langchain/langgraph`
 *   2. Add interrupt nodes to the graph before/after tool execution
 *   3. Use a checkpointer (e.g., MemorySaver) to persist state across interrupts
 *   See: https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/
 *
 * @param options - Agent run options including task, skills, and private key.
 * @returns The agent's final output and intermediate step logs.
 * @throws If the ANTHROPIC_API_KEY is not set.
 * @throws If more than 3 skills are requested.
 *
 * @example
 * ```ts
 * const result = await runAgent({
 *   task: "Swap 0.001 WETH for USDC on Arbitrum Sepolia",
 *   privateKey: wallet.privateKey,
 *   skills: ["uniswap-swap"],
 * });
 * console.log(result.output);
 * ```
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const { task, privateKey, skills = [], streaming = false } = options;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Get a key at https://console.anthropic.com/"
    );
  }

  console.log(`[orchestrator] Starting agent run.`);
  console.log(`[orchestrator] Task: ${task}`);
  console.log(`[orchestrator] Skills: ${skills.length > 0 ? skills.join(", ") : "none"}`);

  // Resolve skill names to LangChain tool instances
  const tools = skills.length > 0 ? resolveSkills(skills, privateKey) : [];

  // Initialize Claude as the LLM
  const llm = new ChatAnthropic({
    model: DEFAULT_MODEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // Streaming is disabled by default. Set to true to enable token-by-token output.
    streaming,
  });

  // Create a ReAct agent using LangGraph
  // Human-in-the-loop is disabled by default. To enable:
  // 1. Add a MemorySaver checkpointer
  // 2. Use interruptBefore or interruptAfter on tool nodes
  // See: https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/
  const agent = createReactAgent({
    llm,
    tools,
  });

  const steps: string[] = [];

  console.log(`[orchestrator] Invoking agent...`);

  // Run the agent
  const result = await agent.invoke(
    { messages: [{ role: "user", content: task }] },
    {
      // To enable human-in-the-loop, add:
      // configurable: { thread_id: "some-thread-id" },
      // and provide a checkpointer to createReactAgent above.
    }
  );

  // Extract the final message
  const messages = result.messages;
  const lastMessage = messages[messages.length - 1];
  const output =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Log intermediate steps
  for (const msg of messages) {
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const role = msg._getType?.() ?? "unknown";
    const stepLog = `[${role}] ${content.slice(0, 200)}`;
    steps.push(stepLog);
  }

  console.log(`[orchestrator] Agent run complete.`);

  return { output, steps };
}

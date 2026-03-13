/**
 * Agent orchestration layer using LangChain.js.
 *
 * Skills are discovered from the agent's `agents/<name>/skills/` directory.
 *
 * @module orchestrator
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "./llm.js";
import { resolveAgentSkills } from "./agent-skills.js";
import type { RunAgentOptions, AgentRunResult } from "./types.js";

/**
 * Runs an autonomous agent with the specified task.
 *
 * If `agentName` is provided, skills are auto-discovered from the agent's
 * skills/ directory.
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const { task, privateKey, agentName, streaming = false } = options;

  let tools: Awaited<ReturnType<typeof resolveAgentSkills>> = [];

  if (agentName) {
    tools = await resolveAgentSkills(agentName, privateKey);
  }

  const skillNames = tools.map((t) => t.name);

  console.log(`[orchestrator] Starting agent run.`);
  if (agentName) console.log(`[orchestrator] Agent: ${agentName}`);
  console.log(`[orchestrator] Task: ${task}`);
  console.log(`[orchestrator] Skills: ${skillNames.length > 0 ? skillNames.join(", ") : "none"}`);

  const llm = await getLLM({ streaming });
  const agent = createReactAgent({ llm, tools });

  const steps: string[] = [];
  console.log(`[orchestrator] Invoking agent...`);

  const messages: { role: string; content: string }[] = [];
  messages.push({ role: "user", content: task });

  const result = await agent.invoke({ messages });

  const resultMessages = result.messages;
  const lastMessage = resultMessages[resultMessages.length - 1];
  const output =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  for (const msg of resultMessages) {
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const role = msg._getType?.() ?? "unknown";
    steps.push(`[${role}] ${content.slice(0, 200)}`);
  }

  console.log(`[orchestrator] Agent run complete.`);
  return { output, steps };
}

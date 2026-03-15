/**
 * Interactive chat with an onchain agent.
 *
 * Usage:
 *   npm run chat                          # pick from existing agents
 *   npm run chat -- --agent my-agent      # open specific agent
 */

import * as fs from "node:fs";
import * as readline from "node:readline";
import dotenv from "dotenv";
import * as p from "@clack/prompts";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "../core/llm.js";
import { AGENTS_DIR, getOrCreateAgentWallet } from "../core/wallet.js";
import { discoverAgentSkills, resolveAgentSkills } from "../core/agent-skills.js";
import { createFileCheckpointer } from "../core/file-checkpoint.js";
import { loadAgentConfig, resolveToolsFromConfig, buildCapabilitySummary } from "../core/agent-config.js";
import { getNetworkNameByChainId, getNetworkConfig } from "../core/config.js";
import type { Skill } from "../actions/types.js";

dotenv.config();

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

function listExistingAgents(): string[] {
  if (!fs.existsSync(AGENTS_DIR)) return [];
  return fs
    .readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(`${AGENTS_DIR}/${e.name}/wallet.json`))
    .map((e) => e.name);
}

async function main() {
  let agentName = getFlag("agent");

  if (!agentName) {
    const agents = listExistingAgents();

    if (agents.length === 0) {
      console.error("No agents found. Create one first with: npm run create-agent");
      process.exit(1);
    }

    p.intro("Agent Chat");
    const selected = await p.select({
      message: "Select an agent",
      options: agents.map((name) => {
        const config = loadAgentConfig(name);
        const hint = config
          ? `actions: ${(config.metadata?.actions ?? []).join(", ") || "none"} | tools: ${(config.metadata?.tools ?? []).join(", ") || "none"}`
          : "legacy agent";
        return { value: name, label: name, hint };
      }),
    });

    if (p.isCancel(selected)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    agentName = selected as string;
  }

  const wallet = getOrCreateAgentWallet({ agentName });
  process.env.AGENT_PRIVATE_KEY = wallet.privateKey;

  // Config-based loading (create-agent) or legacy skill discovery (deploy)
  const agentConfig = loadAgentConfig(agentName);
  let tools: Awaited<ReturnType<typeof resolveAgentSkills>>;
  let skills: Skill[] = [];
  let skillNames: string[];

  if (agentConfig) {
    const resolved = resolveToolsFromConfig(agentConfig);
    tools = resolved.tools;
    skills = resolved.skills;
    skillNames = skills.map((s) => s.name);
  } else {
    skillNames = discoverAgentSkills(agentName).map((c) => c.name);
    tools = await resolveAgentSkills(agentName, wallet.privateKey);
  }

  const { saver, flush } = createFileCheckpointer(agentName);

  console.log();
  console.log("=".repeat(60));
  console.log("  INTERACTIVE AGENT CHAT");
  console.log("=".repeat(60));
  console.log();
  console.log(`  Agent        : ${agentName}`);
  console.log(`  Agent wallet : ${wallet.address}`);
  console.log(`  Tools        : ${tools.map((t) => t.name).join(", ") || "none"}`);
  console.log(`  Skills       : ${skillNames.length > 0 ? skillNames.join(", ") : "none"}`);
  console.log();
  console.log('  Type your message and press Enter. Type "exit" to quit.');
  console.log("=".repeat(60));
  console.log();

  const networkName = agentConfig?.walletChainId
    ? getNetworkNameByChainId(agentConfig.walletChainId)
    : getNetworkConfig().name;

  const skillContext = skills.map((s) => `## Skill: ${s.name}\n\n${s.context}`).join("\n\n");
  const capabilitySummary = agentConfig ? buildCapabilitySummary(agentConfig) : "No capabilities configured.";
  const systemMessage = [
    `You are "${agentName}", an onchain AI agent on ${networkName}.`,
    `Your wallet address is: ${wallet.address}`,
    agentConfig?.walletChainId ? `Chain ID: ${agentConfig.walletChainId}` : "",
    agentConfig?.agentId ? `ERC-8004 Agent ID: ${agentConfig.agentId}` : "",
    "",
    `## Your Capabilities\n\n${capabilitySummary}`,
    skillContext,
  ].filter(Boolean).join("\n");

  const llm = getLLM();
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: saver,
    prompt: systemMessage,
  });
  const threadId = agentName; // stable thread per agent

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => { flush(); console.log("\nGoodbye!\n"); process.exit(0); });

  const prompt = () => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return prompt();
      if (trimmed.toLowerCase() === "exit") { rl.close(); return; }

      try {
        const stream = await agent.stream(
          { messages: [{ role: "user", content: trimmed }] },
          { configurable: { thread_id: threadId }, recursionLimit: 8, streamMode: "updates" },
        );

        for await (const update of stream) {
          // Each update is { nodeName: nodeOutput }
          for (const [nodeName, output] of Object.entries(update)) {
            const messages = (output as any)?.messages ?? [];

            for (const msg of messages) {
              const role = msg._getType?.() ?? "unknown";
              const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

              if (role === "ai") {
                // Show tool calls
                const calls = msg.tool_calls ?? [];
                if (calls.length > 0) {
                  for (const tc of calls) {
                    console.log(`\n  [calling ${tc.name}] ${JSON.stringify(tc.args)}`);
                  }
                }
                // Show text response
                if (content.trim() && (!calls.length || content.trim())) {
                  if (content.trim()) {
                    console.log(`\nagent > ${content}`);
                  }
                }
              } else if (role === "tool") {
                console.log(`  [result] ${content.slice(0, 500)}`);
              }
            }
          }
        }

        console.log();
        flush();
      } catch (err: unknown) {
        console.error(`\n[error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      prompt();
    });
  };
  prompt();
}

main().catch((err) => { console.error(err); process.exit(1); });

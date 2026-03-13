/**
 * Interactive chat with an onchain agent. Conversation persists across restarts.
 * Loads both custom skills and GOAT plugins from the agent directory.
 *
 * Usage:
 *   npm run chat                          # default chat-agent
 *   npm run chat -- --agent my-agent      # uses tools from agents/my-agent/
 */

import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "../core/llm.js";
import { AGENTS_DIR, getOrCreateAgentWallet } from "../core/wallet.js";
import { discoverAgentSkills, resolveAgentSkills } from "../core/agent-skills.js";
import { createFileCheckpointer } from "../core/file-checkpoint.js";
import { resolveGoatTools } from "../core/goat-tools.js";

dotenv.config();

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const agentName = getFlag("agent") || "chat-agent";

function loadGoatConfig(agentName: string): string[] {
  const configPath = path.join(AGENTS_DIR, agentName, "goat-plugins.json");
  if (!fs.existsSync(configPath)) return [];
  try { return JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch { return []; }
}

async function main() {
  const wallet = getOrCreateAgentWallet({ agentName });

  // Load custom skills
  const skillNames = discoverAgentSkills(agentName).map((c) => c.name);
  const customTools = await resolveAgentSkills(agentName, wallet.privateKey);

  // Load GOAT plugins
  const goatPluginNames = loadGoatConfig(agentName);
  const goatTools = await resolveGoatTools(goatPluginNames, wallet.privateKey);

  const allTools = [...customTools, ...goatTools];
  const allToolNames = [...skillNames, ...goatPluginNames];

  const { saver, flush } = createFileCheckpointer(agentName);

  console.log();
  console.log("=".repeat(60));
  console.log("  INTERACTIVE AGENT CHAT");
  console.log("=".repeat(60));
  console.log();
  console.log(`  Agent        : ${agentName}`);
  console.log(`  Agent wallet : ${wallet.address}`);
  console.log(`  Tools        : ${allToolNames.length > 0 ? allToolNames.join(", ") : "none"}`);
  console.log();
  console.log('  Type your message and press Enter. Type "exit" to quit.');
  console.log("=".repeat(60));
  console.log();

  const llm = getLLM();
  const agent = createReactAgent({ llm, tools: allTools, checkpointSaver: saver });
  const threadId = agentName;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => { flush(); console.log("\nGoodbye!\n"); process.exit(0); });

  const prompt = () => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return prompt();
      if (trimmed.toLowerCase() === "exit") { rl.close(); return; }

      try {
        const prevState = await agent.getState({ configurable: { thread_id: threadId } });
        const prevCount = prevState?.values?.messages?.length ?? 0;

        const result = await agent.invoke(
          { messages: [{ role: "user", content: trimmed }] },
          { configurable: { thread_id: threadId } }
        );
        flush();

        const allMessages = result.messages;
        const newMessages = allMessages.slice(prevCount);

        for (const msg of newMessages) {
          const role = (msg as any)._getType?.() ?? "unknown";
          const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

          if (role === "ai" && (msg as any).tool_calls?.length) {
            for (const tc of (msg as any).tool_calls) {
              console.log(`\n  [calling ${tc.name}] ${JSON.stringify(tc.args)}`);
            }
          } else if (role === "tool") {
            console.log(`  [result] ${content.slice(0, 500)}`);
          }
        }

        const last = allMessages[allMessages.length - 1];
        const text = typeof last.content === "string" ? last.content : JSON.stringify(last.content, null, 2);
        if (text.trim()) {
          console.log(`\nagent > ${text}\n`);
        } else {
          console.log(`\nagent > (no response)\n`);
        }
      } catch (err: unknown) {
        console.error(`\n[error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      prompt();
    });
  };
  prompt();
}

main().catch((err) => { console.error(err); process.exit(1); });

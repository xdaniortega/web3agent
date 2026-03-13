/**
 * Interactive chat with an onchain agent. Conversation persists across restarts.
 *
 * Usage:
 *   npm run chat                          # default chat-agent
 *   npm run chat -- --agent my-agent      # uses skills from agents/my-agent/skills/
 */

import * as readline from "node:readline";
import dotenv from "dotenv";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "../core/llm.js";
import { getOrCreateAgentWallet } from "../core/wallet.js";
import { discoverAgentSkills, resolveAgentSkills } from "../core/agent-skills.js";
import { createFileCheckpointer } from "../core/file-checkpoint.js";

dotenv.config();

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const agentName = getFlag("agent") || "chat-agent";

async function main() {
  const wallet = getOrCreateAgentWallet({ agentName });

  const skillNames = discoverAgentSkills(agentName).map((c) => c.name);
  const tools = await resolveAgentSkills(agentName, wallet.privateKey);
  const { saver, flush } = createFileCheckpointer(agentName);

  console.log();
  console.log("=".repeat(60));
  console.log("  INTERACTIVE AGENT CHAT");
  console.log("=".repeat(60));
  console.log();
  console.log(`  Agent        : ${agentName}`);
  console.log(`  Agent wallet : ${wallet.address}`);
  console.log(`  Skills       : ${skillNames.length > 0 ? skillNames.join(", ") : "none"}`);
  console.log();
  console.log('  Type your message and press Enter. Type "exit" to quit.');
  console.log("=".repeat(60));
  console.log();

  const llm = getLLM();
  const agent = createReactAgent({ llm, tools, checkpointSaver: saver });
  const threadId = agentName; // stable thread per agent

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => { flush(); console.log("\nGoodbye!\n"); process.exit(0); });

  const prompt = () => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return prompt();
      if (trimmed.toLowerCase() === "exit") { rl.close(); return; }

      try {
        // Count messages before invoke to find new ones after
        const prevState = await agent.getState({ configurable: { thread_id: threadId } });
        const prevCount = prevState?.values?.messages?.length ?? 0;

        const result = await agent.invoke(
          { messages: [{ role: "user", content: trimmed }] },
          { configurable: { thread_id: threadId } }
        );
        flush();

        // Show only new messages from this turn
        const allMessages = result.messages;
        const newMessages = allMessages.slice(prevCount);

        for (const msg of newMessages) {
          const role = (msg as any)._getType?.() ?? "unknown";
          const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

          if (role === "ai" && (msg as any).tool_calls?.length) {
            const calls = (msg as any).tool_calls;
            for (const tc of calls) {
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

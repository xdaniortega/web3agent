/**
 * Interactive chat with an onchain agent.
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
import {
  discoverAgentSkills,
  resolveAgentSkills,
  buildSkillSystemPrompt,
} from "../core/agent-skills.js";

dotenv.config();

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const agentName = getFlag("agent") || "chat-agent";

async function main() {
  const wallet = getOrCreateAgentWallet({ agentName });

  const configs = discoverAgentSkills(agentName);
  const skillNames = configs.map((c) => c.name);
  const tools = await resolveAgentSkills(agentName, wallet.privateKey);
  const systemPrompt = buildSkillSystemPrompt(configs);

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
  const agent = createReactAgent({ llm, tools });
  const threadId = `chat-${Date.now()}`;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => { console.log("\nGoodbye!\n"); process.exit(0); });

  const prompt = () => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return prompt();
      if (trimmed.toLowerCase() === "exit") { rl.close(); return; }

      try {
        const messages: { role: string; content: string }[] = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        messages.push({ role: "user", content: trimmed });

        const result = await agent.invoke(
          { messages },
          { configurable: { thread_id: threadId } }
        );
        const last = result.messages[result.messages.length - 1];
        const text = typeof last.content === "string" ? last.content : JSON.stringify(last.content, null, 2);
        console.log(`\nagent > ${text}\n`);
      } catch (err: unknown) {
        console.error(`\n[error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      prompt();
    });
  };
  prompt();
}

main().catch((err) => { console.error(err); process.exit(1); });

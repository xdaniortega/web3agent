/**
 * Deploy an agent: create wallet, fund it, install skills, open chat.
 *
 * Usage:
 *   npm run deploy -- --name my-agent
 *   npm run deploy -- --name my-agent --skip-register  # skip ERC-8004 registration
 *   npm run deploy -- --name my-agent --fund 0.005     # custom fund amount
 */

import * as readline from "node:readline";
import dotenv from "dotenv";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "../core/llm.js";
import { getActiveNetwork, getNetworkConfig, getProvider } from "../core/config.js";
import {
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "../core/wallet.js";
import { registerAgent } from "../core/registry.js";
import { discoverAgentSkills, resolveAgentSkills } from "../core/agent-skills.js";
import { createFileCheckpointer } from "../core/file-checkpoint.js";
import { scaffoldAgentSkill, listSkillTemplates } from "../skills/scaffold.js";

dotenv.config();

// ---------------------------------------------------------------------------
// Parse flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")
    ? args[idx + 1]
    : undefined;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const agentName = getFlag("name") || `agent-${Date.now()}`;
const fundAmount = getFlag("fund") || "0.002";
const skipRegister = hasFlag("skip-register");

// ---------------------------------------------------------------------------
// Skill selection prompt
// ---------------------------------------------------------------------------
async function selectSkills(): Promise<string[]> {
  const available = listSkillTemplates();
  if (available.length === 0) {
    console.log("  No skill templates available.\n");
    return [];
  }

  console.log("  Available skills:");
  available.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
  console.log(`    0. Done (proceed with selected skills)`);
  console.log();

  const selected: string[] = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    const ask = () => {
      const label = selected.length > 0 ? ` [selected: ${selected.join(", ")}]` : "";
      rl.question(`  Pick a skill (1-${available.length}) or 0 to finish${label}: `, (answer) => {
        const num = parseInt(answer.trim(), 10);
        if (num === 0 || isNaN(num)) {
          rl.close();
          resolve(selected);
          return;
        }
        if (num >= 1 && num <= available.length) {
          const skill = available[num - 1];
          if (!selected.includes(skill)) {
            selected.push(skill);
            console.log(`  + Added ${skill}`);
          }
        }
        ask();
      });
    };
    ask();
  });
}

// ---------------------------------------------------------------------------
// Interactive chat
// ---------------------------------------------------------------------------
async function startChat(
  agentName: string,
  privateKey: string,
  masterAddress: string
): Promise<void> {
  const skillNames = discoverAgentSkills(agentName).map((c) => c.name);
  const tools = await resolveAgentSkills(agentName, privateKey);
  const { saver, flush } = createFileCheckpointer(agentName);

  console.log();
  console.log("=".repeat(60));
  console.log("  AGENT CHAT");
  console.log("=".repeat(60));
  console.log();
  console.log(`  Agent  : ${agentName}`);
  console.log(`  Skills : ${skillNames.join(", ") || "none"}`);
  console.log(`  Master : ${masterAddress}`);
  console.log();
  console.log('  Type your message and press Enter. Type "exit" to quit.');
  console.log("=".repeat(60));
  console.log();

  const llm = getLLM();
  const agent = createReactAgent({ llm, tools, checkpointSaver: saver });
  const threadId = agentName;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => { flush(); console.log("\nGoodbye!\n"); process.exit(0); });

  const prompt = () => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return prompt();
      if (trimmed.toLowerCase() === "exit") { rl.close(); return; }

      try {
        const result = await agent.invoke(
          { messages: [{ role: "user", content: trimmed }] },
          { configurable: { thread_id: threadId } }
        );
        flush();

        const last = result.messages[result.messages.length - 1];
        const text = typeof last.content === "string"
          ? last.content
          : JSON.stringify(last.content, null, 2);

        console.log(`\nagent > ${text}\n`);
      } catch (err: unknown) {
        console.error(`\n[error] ${err instanceof Error ? err.message : String(err)}\n`);
      }
      prompt();
    });
  };
  prompt();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log();
  console.log("=".repeat(60));
  console.log("  DEPLOY AGENT");
  console.log("=".repeat(60));
  console.log();

  const network = getActiveNetwork();
  const networkConfig = getNetworkConfig();
  console.log(`  Network : ${networkConfig.name} (${network})`);

  const masterWallet = getMasterWallet();
  console.log(`  Master  : ${masterWallet.address}`);

  const masterBalance = await getMasterWalletBalance();
  console.log(`  Balance : ${masterBalance} ETH`);
  console.log();

  console.log(`  Creating agent "${agentName}"...`);
  const agentWallet = getOrCreateAgentWallet({ agentName });
  console.log(`  Wallet  : ${agentWallet.address}`);
  console.log();

  console.log("  Select skills to install:\n");
  const selectedSkills = await selectSkills();
  console.log();

  for (const skill of selectedSkills) {
    scaffoldAgentSkill(agentName, skill);
  }
  if (selectedSkills.length > 0) console.log();

  console.log(`  Funding agent with ${fundAmount} ETH...`);
  try {
    const txHash = await fundAgentWallet({
      agentAddress: agentWallet.address,
      amountEth: fundAmount,
    });
    console.log(`  TX: ${txHash}`);
    const provider = getProvider();
    const receipt = await provider.waitForTransaction(txHash);
    console.log(`  Confirmed in block ${receipt?.blockNumber}`);
  } catch (err) {
    console.error(`  Funding failed: ${err instanceof Error ? err.message : err}`);
    console.log("  The agent has no balance — transactions will fail.");
  }
  console.log();

  if (!skipRegister) {
    console.log("  Registering on ERC-8004...");
    try {
      const reg = await registerAgent({
        name: agentName,
        description: `Agent ${agentName}`,
        privateKey: agentWallet.privateKey,
        walletAddress: agentWallet.address,
      });
      console.log(`  Registered. Agent ID: ${reg.agentId}`);
    } catch (err) {
      console.error(`  Registration failed: ${err instanceof Error ? err.message : err}`);
    }
    console.log();
  } else {
    console.log("  Skipping ERC-8004 registration (--skip-register).\n");
  }

  const provider = getProvider();
  const agentBalance = await provider.getBalance(agentWallet.address);
  const { ethers } = await import("ethers");
  const agentBalanceEth = ethers.formatEther(agentBalance);

  console.log("=".repeat(60));
  console.log("  AGENT DEPLOYED");
  console.log("=".repeat(60));
  console.log();
  console.log(`  Name    : ${agentName}`);
  console.log(`  Wallet  : ${agentWallet.address}`);
  console.log(`  Balance : ${agentBalanceEth} ETH`);
  console.log(`  Skills  : ${selectedSkills.join(", ") || "none"}`);
  console.log(`  Master  : ${masterWallet.address}`);
  console.log();
  console.log("  Opening interactive chat...");

  await startChat(agentName, agentWallet.privateKey, masterWallet.address);
}

main().catch((err) => {
  console.error(`[deploy] Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

/**
 * Deploy an agent: create wallet, pick skills + GOAT tools, fund, register, chat.
 *
 * Usage:
 *   npm run deploy -- --name my-agent
 *   npm run deploy -- --name my-agent --skip-register
 *   npm run deploy -- --name my-agent --fund 0.005
 */

import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import * as p from "@clack/prompts";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "../core/llm.js";
import { getActiveNetwork, getNetworkConfig, getProvider } from "../core/config.js";
import {
  AGENTS_DIR,
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "../core/wallet.js";
import { registerAgent } from "../core/registry.js";
import { discoverAgentSkills, resolveAgentSkills } from "../core/agent-skills.js";
import { createFileCheckpointer } from "../core/file-checkpoint.js";
import { scaffoldAgentSkill, listSkillTemplates } from "../skills/scaffold.js";
import {
  GOAT_PLUGIN_REGISTRY,
  getGoatCategories,
  getGoatPluginsByCategory,
  resolveGoatTools,
} from "../core/goat-tools.js";

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

const skipRegister = hasFlag("skip-register");

// ---------------------------------------------------------------------------
// Tool selection — custom skills + GOAT tools in categorized groups
// ---------------------------------------------------------------------------
async function selectTools(): Promise<{ customSkills: string[]; goatPlugins: string[] }> {
  const customTemplates = listSkillTemplates();
  const goatCategories = getGoatCategories();

  // Build grouped options for clack
  type Option = { value: string; label: string; hint?: string };
  const options: (Option | { separator: true; label?: string })[] = [];

  // Custom skill templates
  if (customTemplates.length > 0) {
    options.push({ separator: true, label: "Custom Skills" } as any);
    for (const t of customTemplates) {
      options.push({ value: `custom:${t}`, label: t, hint: "local template" });
    }
  }

  // GOAT plugins by category
  for (const category of goatCategories) {
    const plugins = getGoatPluginsByCategory(category);
    options.push({ separator: true, label: `GOAT - ${category}` } as any);
    for (const plugin of plugins) {
      options.push({
        value: `goat:${plugin.name}`,
        label: plugin.name,
        hint: plugin.description,
      });
    }
  }

  const result = await p.multiselect({
    message: "Select tools for your agent",
    options: options as Option[],
    required: false,
  });

  if (p.isCancel(result)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const selected = result as string[];
  const customSkills = selected
    .filter((s) => s.startsWith("custom:"))
    .map((s) => s.replace("custom:", ""));
  const goatPlugins = selected
    .filter((s) => s.startsWith("goat:"))
    .map((s) => s.replace("goat:", ""));

  return { customSkills, goatPlugins };
}

// ---------------------------------------------------------------------------
// Save GOAT config to agent directory for later reload
// ---------------------------------------------------------------------------
function saveGoatConfig(agentName: string, pluginNames: string[]): void {
  const configPath = path.join(AGENTS_DIR, agentName, "goat-plugins.json");
  fs.writeFileSync(configPath, JSON.stringify(pluginNames, null, 2), "utf-8");
}

function loadGoatConfig(agentName: string): string[] {
  const configPath = path.join(AGENTS_DIR, agentName, "goat-plugins.json");
  if (!fs.existsSync(configPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Interactive chat (post-deploy)
// ---------------------------------------------------------------------------
async function startChat(
  agentName: string,
  privateKey: string,
  masterAddress: string
): Promise<void> {
  const skillNames = discoverAgentSkills(agentName).map((c) => c.name);
  const customTools = await resolveAgentSkills(agentName, privateKey);

  // Load GOAT tools
  const goatPluginNames = loadGoatConfig(agentName);
  const goatTools = await resolveGoatTools(goatPluginNames, privateKey);

  const allTools = [...customTools, ...goatTools];
  const allToolNames = [...skillNames, ...goatPluginNames];

  const { saver, flush } = createFileCheckpointer(agentName);

  console.log();
  console.log(`  Agent  : ${agentName}`);
  console.log(`  Tools  : ${allToolNames.join(", ") || "none"}`);
  console.log(`  Master : ${masterAddress}`);
  console.log();
  console.log('  Type your message and press Enter. Type "exit" to quit.');
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
        const text = typeof last.content === "string"
          ? last.content
          : JSON.stringify(last.content, null, 2);

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  p.intro("Deploy Agent");

  // --- Network info ---
  const network = getActiveNetwork();
  const networkConfig = getNetworkConfig();
  const masterWallet = getMasterWallet();
  const masterBalance = await getMasterWalletBalance();

  p.note(
    `Network : ${networkConfig.name} (${network})\n` +
    `Master  : ${masterWallet.address}\n` +
    `Balance : ${masterBalance} ETH`,
    "Environment"
  );

  // --- Agent name ---
  const nameFromFlag = getFlag("name");
  let agentName: string;

  if (nameFromFlag) {
    agentName = nameFromFlag;
  } else {
    const nameResult = await p.text({
      message: "Agent name",
      placeholder: "my-agent",
      validate: (v) => !v?.trim() ? "Name is required" : undefined,
    });
    if (p.isCancel(nameResult)) { p.cancel("Cancelled."); process.exit(0); }
    agentName = nameResult;
  }

  // --- Create wallet ---
  const s = p.spinner();
  s.start(`Creating agent "${agentName}"...`);
  const agentWallet = getOrCreateAgentWallet({ agentName });
  s.stop(`Agent wallet: ${agentWallet.address}`);

  // --- Select tools (custom skills + GOAT) ---
  const { customSkills, goatPlugins } = await selectTools();

  // Install custom skill templates
  for (const skill of customSkills) {
    scaffoldAgentSkill(agentName, skill);
  }

  // Save GOAT plugin config
  if (goatPlugins.length > 0) {
    saveGoatConfig(agentName, goatPlugins);
    p.log.success(`GOAT plugins: ${goatPlugins.join(", ")}`);
  }

  // --- Fund amount ---
  const fundFromFlag = getFlag("fund");
  let fundAmount: string;

  if (fundFromFlag) {
    fundAmount = fundFromFlag;
  } else {
    const fundResult = await p.text({
      message: "ETH to fund agent",
      placeholder: "0.002",
      initialValue: "0.002",
    });
    if (p.isCancel(fundResult)) { p.cancel("Cancelled."); process.exit(0); }
    fundAmount = fundResult || "0.002";
  }

  // --- Fund agent ---
  s.start(`Funding agent with ${fundAmount} ETH...`);
  try {
    const txHash = await fundAgentWallet({
      agentAddress: agentWallet.address,
      amountEth: fundAmount,
    });
    const provider = getProvider();
    const receipt = await provider.waitForTransaction(txHash);
    s.stop(`Funded (block ${receipt?.blockNumber}): ${txHash}`);
  } catch (err) {
    s.stop(`Funding failed: ${err instanceof Error ? err.message : err}`);
  }

  // --- Registration ---
  if (!skipRegister) {
    s.start("Registering on ERC-8004...");
    try {
      const reg = await registerAgent({
        name: agentName,
        description: `Agent ${agentName}`,
        privateKey: agentWallet.privateKey,
        walletAddress: agentWallet.address,
      });
      s.stop(`Registered. Agent ID: ${reg.agentId}`);
    } catch (err) {
      s.stop(`Registration failed: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    p.log.info("Skipping ERC-8004 registration (--skip-register)");
  }

  // --- Summary ---
  const provider = getProvider();
  const agentBalance = await provider.getBalance(agentWallet.address);
  const { ethers } = await import("ethers");

  const allToolNames = [
    ...discoverAgentSkills(agentName).map((c) => c.name),
    ...goatPlugins,
  ];

  p.note(
    `Name    : ${agentName}\n` +
    `Wallet  : ${agentWallet.address}\n` +
    `Balance : ${ethers.formatEther(agentBalance)} ETH\n` +
    `Tools   : ${allToolNames.join(", ") || "none"}\n` +
    `Master  : ${masterWallet.address}`,
    "Agent Deployed"
  );

  // --- Open chat ---
  const chatResult = await p.confirm({
    message: "Open interactive chat?",
    initialValue: true,
  });

  if (p.isCancel(chatResult) || !chatResult) {
    p.outro("Done. Run `npm run chat -- --agent " + agentName + "` to chat later.");
    return;
  }

  p.outro("Starting chat...");
  await startChat(agentName, agentWallet.privateKey, masterWallet.address);
}

main().catch((err) => {
  p.cancel(`Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

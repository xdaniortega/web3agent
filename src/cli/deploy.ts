/**
 * Deploy an agent: create wallet, fund it, install skills, open chat.
 *
 * Usage:
 *   npm run deploy -- --name my-agent
 *   npm run deploy -- --name my-agent --skip-register
 *   npm run deploy -- --name my-agent --fund 0.005
 */

import * as readline from "node:readline";
import dotenv from "dotenv";
import * as p from "@clack/prompts";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLLM } from "../core/llm.js";
import { getActiveNetwork, getNetworkConfig, getProvider } from "../core/config.js";
import {
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "../core/wallet.js";
import { createSmartWallet } from "../core/smart-wallet.js";
import { applyPolicy, POLICY_PRESETS } from "../core/policy.js";
import type { PolicyPreset } from "../core/policy.js";
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

const skipRegister = hasFlag("skip-register");

// ---------------------------------------------------------------------------
// Interactive chat (post-deploy)
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
  console.log(`  Agent  : ${agentName}`);
  console.log(`  Skills : ${skillNames.join(", ") || "none"}`);
  console.log(`  Master : ${masterAddress}`);
  console.log();
  console.log('  Type your message and press Enter. Type "exit" to quit.');
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
            const calls = (msg as any).tool_calls;
            for (const tc of calls) {
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

  // --- Smart wallet (ERC-7702 + 4337) ---
  const hasZeroDev = !!process.env.ZERODEV_RPC;
  let smartWalletAddress: string | undefined;

  if (hasZeroDev) {
    const walletModeResult = await p.confirm({
      message: "Enable ERC-7702 smart wallet with paymaster? (requires ZERODEV_RPC)",
      initialValue: true,
    });

    if (!p.isCancel(walletModeResult) && walletModeResult) {
      s.start("Creating ERC-7702 Kernel smart wallet...");
      try {
        const smartWallet = await createSmartWallet({
          privateKey: agentWallet.privateKey,
        });
        smartWalletAddress = smartWallet.address;
        s.stop(`Smart wallet (7702): ${smartWallet.address}`);

        // --- Policy assignment ---
        const policyResult = await p.select({
          message: "Select spending policy for this agent",
          options: [
            { value: "conservative", label: "Conservative — 0.01 ETH limit, 10 ops" },
            { value: "standard", label: "Standard — 0.5 ETH limit, 100 ops" },
            { value: "unrestricted", label: "Unrestricted — no limits (use with caution)" },
            { value: "skip", label: "Skip — no policy (agent uses sudo key)" },
          ],
        });

        if (!p.isCancel(policyResult) && policyResult !== "skip") {
          s.start(`Applying "${policyResult}" policy...`);
          try {
            const session = await applyPolicy(smartWallet, policyResult as PolicyPreset);

            // Persist session key to agent directory
            const agentDir = (await import("node:path")).join(
              (await import("../core/wallet.js")).AGENTS_DIR,
              agentName
            );
            const fs = await import("node:fs");
            fs.writeFileSync(
              (await import("node:path")).join(agentDir, "session.json"),
              JSON.stringify(
                {
                  address: session.address,
                  privateKey: session.privateKey,
                  serialized: session.serialized,
                  policy: policyResult,
                  expiresAt: session.expiresAt ?? null,
                },
                null,
                2
              ),
              "utf-8"
            );

            s.stop(`Policy applied. Session key: ${session.address}`);
          } catch (err) {
            s.stop(`Policy failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      } catch (err) {
        s.stop(`Smart wallet failed: ${err instanceof Error ? err.message : err}`);
        p.log.warn(
          "Falling back to standard EOA wallet. Check your ZERODEV_RPC configuration."
        );
      }
    }
  }

  // --- Select skills ---
  const available = listSkillTemplates();
  if (available.length > 0) {
    const skillResult = await p.multiselect({
      message: "Select skills to install",
      options: available.map((s) => ({ value: s, label: s })),
      required: false,
    });

    if (p.isCancel(skillResult)) { p.cancel("Cancelled."); process.exit(0); }

    const selectedSkills = skillResult as string[];
    for (const skill of selectedSkills) {
      scaffoldAgentSkill(agentName, skill);
    }
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

  const discoveredSkills = discoverAgentSkills(agentName).map((c) => c.name);

  const summaryLines = [
    `Name    : ${agentName}`,
    `Wallet  : ${agentWallet.address}`,
  ];
  if (smartWalletAddress) {
    summaryLines.push(`Smart   : ${smartWalletAddress} (ERC-7702 + 4337)`);
  }
  summaryLines.push(
    `Balance : ${ethers.formatEther(agentBalance)} ETH`,
    `Skills  : ${discoveredSkills.join(", ") || "none"}`,
    `Master  : ${masterWallet.address}`
  );

  p.note(summaryLines.join("\n"), "Agent Deployed");

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

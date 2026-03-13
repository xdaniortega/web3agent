/**
 * End-to-end test: fund an agent, install token-balance skill, ask it to check balance.
 */

import dotenv from "dotenv";
import { getActiveNetwork, getNetworkConfig, getProvider } from "../core/config.js";
import {
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "../core/wallet.js";
import { runAgent } from "../core/orchestrator.js";
import { discoverAgentSkills } from "../core/agent-skills.js";
import { scaffoldAgentSkill } from "../skills/scaffold.js";

dotenv.config();

const AGENT_NAME = "test-agent";
const FUND_AMOUNT = "0.002";

async function main(): Promise<void> {
  console.log("[test] === web3agent-sdk End-to-End Test ===\n");

  const network = getActiveNetwork();
  const networkConfig = getNetworkConfig();
  console.log(`[test] Network: ${networkConfig.name} (${network})`);

  const masterWallet = getMasterWallet();
  console.log(`[test] Master wallet: ${masterWallet.address}`);

  const balance = await getMasterWalletBalance();
  console.log(`[test] Master balance: ${balance} ETH\n`);

  console.log(`[test] Creating/loading agent wallet "${AGENT_NAME}"...`);
  const agentWallet = getOrCreateAgentWallet({ agentName: AGENT_NAME });
  console.log(`[test] Agent wallet: ${agentWallet.address}\n`);

  console.log(`[test] Installing skills...`);
  scaffoldAgentSkill(AGENT_NAME, "token-balance");

  const discoveredSkills = discoverAgentSkills(AGENT_NAME);
  console.log(`[test] Discovered: ${discoveredSkills.map((s) => s.name).join(", ") || "none"}\n`);

  console.log(`[test] Funding agent with ${FUND_AMOUNT} ETH...`);
  try {
    const txHash = await fundAgentWallet({
      agentAddress: agentWallet.address,
      amountEth: FUND_AMOUNT,
    });
    console.log(`[test] Funding TX: ${txHash}`);
    const provider = getProvider();
    const receipt = await provider.waitForTransaction(txHash);
    console.log(`[test] Confirmed in block ${receipt?.blockNumber}\n`);
  } catch (err) {
    console.error(`[test] Funding failed: ${err instanceof Error ? err.message : err}`);
    console.log(`[test] Continuing anyway...\n`);
  }

  const task = [
    `You are an onchain agent on Arbitrum Sepolia.`,
    `Your wallet address is ${agentWallet.address}.`,
    `Check your ETH balance using the token-balance skill.`,
    `Report back what your balance is.`,
  ].join(" ");

  console.log(`[test] Running agent...\n`);
  console.log(`[test] Task: ${task}\n`);

  try {
    const result = await runAgent({
      task,
      privateKey: agentWallet.privateKey,
      agentName: AGENT_NAME,
    });

    console.log(`\n[test] === Agent Response ===`);
    console.log(result.output);
    console.log();
  } catch (err) {
    console.error(`[test] Agent run failed: ${err instanceof Error ? err.message : err}`);
  }

  const finalMasterBalance = await getMasterWalletBalance();
  console.log(`[test] === Final State ===`);
  console.log(`[test] Agent wallet:   ${agentWallet.address}`);
  console.log(`[test] Master balance: ${finalMasterBalance} ETH`);
  console.log(`[test] === Done ===`);
}

main().catch((err) => {
  console.error(`[test] Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

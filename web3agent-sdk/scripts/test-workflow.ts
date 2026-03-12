/**
 * End-to-end test script for the web3agent-sdk.
 *
 * Exercises the full stack: wallet creation, funding, ERC-8004 registration,
 * and agent orchestration with the uniswap-swap skill.
 *
 * Usage: npx tsx scripts/test-workflow.ts
 */

import * as dotenv from "dotenv";
import * as readline from "node:readline";
import {
  getActiveNetwork,
  getNetworkConfig,
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
  registerAgent,
  runAgent,
} from "../src/index.js";

dotenv.config();

const AGENT_NAME = "test-agent";
const FUND_AMOUNT = "0.002";
const MIN_MASTER_BALANCE = "0.005";

// Arbitrum Sepolia token addresses for the test swap
const WETH_SEPOLIA = "0x980B62Da83eFf3D4576C647993b0c1V7aaf96259";
const USDC_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

async function waitForKeypress(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main(): Promise<void> {
  console.log("[test] === web3agent-sdk End-to-End Test ===\n");

  // Step 1: Print active network and master wallet info
  const network = getActiveNetwork();
  const networkConfig = getNetworkConfig();
  console.log(`[test] Active network: ${networkConfig.name} (${network})`);

  const masterWallet = getMasterWallet();
  console.log(`[test] Master wallet address: ${masterWallet.address}\n`);

  // Step 2: Check master wallet balance
  let balance = await getMasterWalletBalance();
  console.log(`[test] Master wallet balance: ${balance} ETH`);

  if (parseFloat(balance) < parseFloat(MIN_MASTER_BALANCE)) {
    console.log(`[test] WARNING: Master wallet balance is below ${MIN_MASTER_BALANCE} ETH.`);
    console.log(`[test] The master wallet needs Sepolia ETH to fund agent wallets and pay for gas.`);
    console.log(`[test] Master wallet address: ${masterWallet.address}`);
    console.log(`[test] Get Sepolia ETH from the Alchemy faucet: https://www.alchemy.com/faucets/arbitrum-sepolia`);
    console.log();

    const answer = await waitForKeypress(
      "[test] Press ENTER after funding the wallet, or type 'skip' to continue anyway: "
    );

    if (answer !== "skip") {
      // Re-check balance after funding
      balance = await getMasterWalletBalance();
      console.log(`[test] Updated master wallet balance: ${balance} ETH`);
      if (parseFloat(balance) < parseFloat(MIN_MASTER_BALANCE)) {
        console.log(`[test] Balance is still below threshold. Proceeding anyway...`);
      }
    } else {
      console.log(`[test] Skipping balance check.`);
    }
  }

  console.log();

  // Step 3: Create or load agent wallet
  console.log(`[test] Creating/loading agent wallet for "${AGENT_NAME}"...`);
  const agentWallet = getOrCreateAgentWallet({ agentName: AGENT_NAME });
  console.log(`[test] Agent wallet address: ${agentWallet.address}\n`);

  // Step 4: Fund agent wallet from master
  console.log(`[test] Funding agent wallet with ${FUND_AMOUNT} ETH...`);
  try {
    const fundTxHash = await fundAgentWallet({
      agentAddress: agentWallet.address,
      amountEth: FUND_AMOUNT,
    });
    console.log(`[test] Funding TX: ${fundTxHash}\n`);
  } catch (err) {
    console.error(`[test] Funding failed: ${err instanceof Error ? err.message : err}`);
    console.log(`[test] Continuing without funding...\n`);
  }

  // Step 5: Register agent on ERC-8004
  let agentId = "unregistered";
  console.log(`[test] Registering agent on ERC-8004...`);
  try {
    const registration = await registerAgent({
      name: AGENT_NAME,
      description: "Test agent for web3agent-sdk end-to-end validation",
      privateKey: agentWallet.privateKey,
      walletAddress: agentWallet.address,
    });
    agentId = registration.agentId;
    console.log(`[test] Registration successful. Agent ID: ${agentId}\n`);
  } catch (err) {
    // Registration failure is not fatal — log and continue
    console.error(`[test] ERC-8004 registration failed: ${err instanceof Error ? err.message : err}`);
    console.log(`[test] Continuing without registration...\n`);
  }

  // Step 6: Run agent with uniswap-swap skill
  console.log(`[test] Running agent with uniswap-swap skill...`);
  console.log(`[test] Task: Swap 0.0001 WETH for USDC on Arbitrum Sepolia\n`);
  try {
    const result = await runAgent({
      task: `Swap 0.0001 WETH for USDC on Arbitrum Sepolia. Use the uniswap-swap tool with these parameters: tokenIn=${WETH_SEPOLIA}, tokenOut=${USDC_SEPOLIA}, amount=0.0001, feeTier=3000`,
      privateKey: agentWallet.privateKey,
      skills: ["uniswap-swap"],
    });

    console.log(`\n[test] === Agent Output ===`);
    console.log(result.output);
  } catch (err) {
    console.error(`[test] Agent run failed: ${err instanceof Error ? err.message : err}`);
  }

  // Step 7: Print summary
  console.log(`\n[test] === Summary ===`);
  console.log(`[test] Network: ${networkConfig.name}`);
  console.log(`[test] Agent Name: ${AGENT_NAME}`);
  console.log(`[test] Agent ID: ${agentId}`);
  console.log(`[test] Agent Wallet: ${agentWallet.address}`);
  console.log(`[test] Master Wallet: ${masterWallet.address}`);
  console.log(`[test] === End ===`);
}

main().catch((err) => {
  console.error(`[test] Fatal error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

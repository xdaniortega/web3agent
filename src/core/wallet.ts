/**
 * Wallet management for agent and master wallets.
 * @module wallet
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ethers } from "ethers";
import { getProvider } from "./config.js";
import type { WalletData, WalletOptions, FundAgentOptions } from "./types.js";

/**
 * Root directory for agent runtime data.
 * Each agent gets its own subdirectory: agents/<agent-name>/
 */
export const AGENTS_DIR = path.resolve(process.cwd(), "agents");

/**
 * Creates or loads an isolated wallet for the named agent.
 *
 * - On first run, generates a cryptographically random private key and persists it.
 * - On subsequent runs, loads the existing wallet without overwriting.
 *
 * WARNING: agents/<name>/wallet.json contains a raw private key.
 * It MUST be listed in .gitignore and NEVER committed to version control.
 *
 * @param options - Wallet creation/loading options.
 * @returns The wallet data (address and private key).
 */
export function getOrCreateAgentWallet(options: WalletOptions): WalletData {
  const { agentName } = options;
  const agentDir = path.join(AGENTS_DIR, agentName);
  const walletPath = path.join(agentDir, "wallet.json");

  // Load existing wallet if present — never overwrite
  if (fs.existsSync(walletPath)) {
    const raw = fs.readFileSync(walletPath, "utf-8");
    const data = JSON.parse(raw) as WalletData;
    console.log(`[wallet] Loaded existing wallet for agent "${agentName}": ${data.address}`);
    return data;
  }

  // Generate a new wallet with a cryptographically random private key
  const wallet = ethers.Wallet.createRandom();
  const data: WalletData = {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };

  // Persist to disk
  fs.mkdirSync(agentDir, { recursive: true });
  fs.writeFileSync(walletPath, JSON.stringify(data, null, 2), "utf-8");

  // WARNING: wallet.json contains a private key. Never commit this file.
  console.log(`[wallet] Created new wallet for agent "${agentName}": ${data.address}`);
  console.log(`[wallet] WARNING: agents/${agentName}/wallet.json contains a private key. Never commit this file.`);

  return data;
}

/**
 * Returns an ethers Wallet instance for the master wallet.
 *
 * The master wallet is configured via the MASTER_PRIVATE_KEY environment variable.
 * It is used exclusively to fund newly created agent wallets.
 *
 * @returns An ethers Wallet connected to the active network's provider.
 * @throws If MASTER_PRIVATE_KEY is not set.
 */
export function getMasterWallet(): ethers.Wallet {
  const privateKey = process.env.MASTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "MASTER_PRIVATE_KEY is not set. This wallet is needed to fund agent wallets.\n" +
        "Set it in your .env file."
    );
  }
  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Returns the ETH balance of the master wallet in ether (as a string).
 *
 * @returns The balance in ETH.
 */
export async function getMasterWalletBalance(): Promise<string> {
  const wallet = getMasterWallet();
  const balance = await wallet.provider!.getBalance(wallet.address);
  return ethers.formatEther(balance);
}

/**
 * Sends a small amount of ETH from the master wallet to an agent wallet.
 *
 * Used to fund newly created agent wallets so they can pay for gas
 * (e.g., ERC-8004 registration, token approvals, swaps).
 *
 * @param options - Funding options including the agent address and amount.
 * @returns The funding transaction hash.
 * @throws If the master wallet has insufficient balance.
 */
export async function fundAgentWallet(options: FundAgentOptions): Promise<string> {
  const { agentAddress, amountEth = "0.001" } = options;
  const master = getMasterWallet();

  const amountWei = ethers.parseEther(amountEth);

  console.log(`[wallet] Funding agent ${agentAddress} with ${amountEth} ETH from master wallet...`);
  const tx = await master.sendTransaction({
    to: agentAddress,
    value: amountWei,
  });
  await tx.wait();
  console.log(`[wallet] Funded agent wallet. TX: ${tx.hash}`);
  return tx.hash;
}

/**
 * web3agent-sdk — Deploy autonomous AI agents on Arbitrum.
 *
 * This is the public entry point. All consumer-facing functions and types
 * are re-exported from here. Import from "web3agent-sdk" only.
 *
 * @packageDocumentation
 */

// --- Configuration ---
export { getActiveNetwork, getNetworkConfig, getProvider, getChainId } from "./config.js";

// --- Wallet Management ---
export {
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "./wallet.js";

// --- Agent Orchestration ---
export { runAgent } from "./orchestrator.js";

// --- ERC-8004 Registration ---
export { registerAgent } from "./registry.js";

// --- Skills ---
export { listSkills, resolveSkills, createUniswapSwapSkill } from "./skills/index.js";

// --- Types ---
export type {
  NetworkName,
  NetworkConfig,
  WalletData,
  WalletOptions,
  FundAgentOptions,
  RegisterAgentOptions,
  RegistrationResult,
  RunAgentOptions,
  AgentRunResult,
  SwapInput,
  SwapResult,
} from "./types.js";

export type { SkillFactory } from "./skills/index.js";

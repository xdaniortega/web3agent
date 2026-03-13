/**
 * web3agent-sdk — Deploy autonomous AI agents on Arbitrum.
 * @packageDocumentation
 */

export { getActiveNetwork, getNetworkConfig, getProvider, getRpcUrl, getChainId } from "./core/config.js";
export { getLLM } from "./core/llm.js";
export type { LLMProvider } from "./core/llm.js";
export {
  AGENTS_DIR,
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "./core/wallet.js";
export { runAgent } from "./core/orchestrator.js";
export { registerAgent } from "./core/registry.js";
export {
  discoverAgentSkills,
  listAgentSkills,
  resolveAgentSkills,
  buildSkillSystemPrompt,
} from "./core/agent-skills.js";
export type { SkillFactory } from "./core/agent-skills.js";
export { createFileCheckpointer } from "./core/file-checkpoint.js";
export { scaffoldAgentSkill, listSkillTemplates } from "./skills/scaffold.js";
export {
  GOAT_PLUGIN_REGISTRY,
  getGoatCategories,
  getGoatPluginsByCategory,
  resolveGoatTools,
} from "./core/goat-tools.js";
export type { GoatPluginEntry } from "./core/goat-tools.js";

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
  AgentSkillConfig,
  SwapInput,
  SwapResult,
} from "./core/types.js";

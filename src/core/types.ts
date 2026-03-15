/**
 * Shared types for web3agent.
 * @module types
 */

/** Supported network identifiers. */
export type NetworkName = "arbitrum-sepolia" | "arbitrum-one" | "robinhood-testnet";

/** Network configuration entry. */
export interface NetworkConfig {
  /** Human-readable network name. */
  name: string;
  /** EVM chain ID. */
  chainId: number;
  /** Default RPC URL used when RPC_URL is not set. */
  defaultRpcUrl: string;
}

/** Persisted wallet data stored in agents/<name>/wallet.json. */
export interface WalletData {
  /** Ethereum address (checksummed). */
  address: string;
  /** Hex-encoded private key. WARNING: Never commit this file. */
  privateKey: string;
}

/** Options for creating or loading an agent wallet. */
export interface WalletOptions {
  /** Unique agent name. Used as the directory name under agents/. */
  agentName: string;
}

/** Options for funding an agent wallet from the master wallet. */
export interface FundAgentOptions {
  /** Agent wallet address to fund. */
  agentAddress: string;
  /** Amount of ETH to send as a human-readable string (e.g. "0.001"). */
  amountEth?: string;
}

/** Options for registering an agent on the ERC-8004 Identity Registry. */
export interface RegisterAgentOptions {
  /** Agent display name. */
  name: string;
  /** Short description of the agent's purpose. */
  description: string;
  /** Agent's private key (hex string) for signing the registration transaction. */
  privateKey: string;
  /** Agent's wallet address. */
  walletAddress: string;
}

/** Result returned after successful ERC-8004 registration. */
export interface RegistrationResult {
  /** Assigned agent ID on the registry. */
  agentId: string;
  /** Transaction hash of the registration. */
  txHash: string;
}

/** Parsed SKILL.md file from an agent's skills directory. */
export interface AgentSkillConfig {
  /** Skill name, must match a key in the skill registry. */
  name: string;
  /** Optional description override for this agent's context. */
  description?: string;
  /** Optional markdown body with usage instructions (injected into system prompt). */
  instructions?: string;
}

/** Options for running an agent via the orchestrator. */
export interface RunAgentOptions {
  /** Natural-language task for the agent to execute. */
  task: string;
  /** Agent's private key, passed to skill factories so they can sign transactions. */
  privateKey: string;
  /** Agent name, skills are discovered from agents/<name>/skills/. */
  agentName?: string;
  /**
   * Enable streaming output from the model.
   * Disabled by default. Set to true to stream token-by-token.
   */
  streaming?: boolean;
}

/** Result returned by the orchestrator after an agent run. */
export interface AgentRunResult {
  /** Final text output from the agent. */
  output: string;
  /** Intermediate step logs. */
  steps: string[];
}

/** Inputs for the Uniswap V3 swap skill. */
export interface SwapInput {
  /** Address of the token to sell. */
  tokenIn: string;
  /** Address of the token to buy. */
  tokenOut: string;
  /** Human-readable amount of tokenIn to swap (e.g. "0.001"). */
  amount: string;
  /** Uniswap V3 fee tier in basis points (e.g. 3000 for 0.3%). */
  feeTier: number;
}

/** Result of a swap execution. */
export interface SwapResult {
  /** Whether the swap succeeded. */
  success: boolean;
  /** Transaction hash on success. */
  txHash?: string;
  /** Error message on failure. */
  error?: string;
}

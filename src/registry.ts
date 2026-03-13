/**
 * ERC-8004 Identity Registry integration.
 *
 * Uses the @blockbyvlog/agent0-sdk package to register agents on the
 * ERC-8004 Identity Registry. This gives each agent a verifiable onchain
 * identity that other agents and protocols can reference.
 *
 * NOTE: The @blockbyvlog/agent0-sdk is in alpha. Registration is best-effort.
 * Always wrap calls in try/catch and handle failures gracefully.
 *
 * @module registry
 */

import { SDK } from "@blockbyvlog/agent0-sdk";
import type { RegisterAgentOptions, RegistrationResult } from "./types.js";
import { getActiveNetwork, getNetworkConfig, getRpcUrl } from "./config.js";

/**
 * Registers an agent on the ERC-8004 Identity Registry.
 *
 * By default, uses HTTP registration mode (no IPFS required, works out of the
 * box on testnet). To switch to Pinata IPFS mode, set the PINATA_JWT
 * environment variable and change the registration call from
 * `agent.registerHTTP(...)` to `agent.registerIPFS()`.
 *
 * NOTE: The @blockbyvlog/agent0-sdk is in alpha. Registration is best-effort
 * and may fail on certain networks or under load. Callers should always wrap
 * this function in try/catch.
 *
 * @param options - Registration options.
 * @returns The registration result with agent ID and transaction hash.
 * @throws If registration fails (SDK error, network error, etc.).
 *
 * @example
 * ```ts
 * try {
 *   const result = await registerAgent({
 *     name: "my-swap-agent",
 *     description: "Executes Uniswap swaps on Arbitrum Sepolia",
 *     privateKey: wallet.privateKey,
 *     walletAddress: wallet.address,
 *   });
 *   console.log(`Registered as agent #${result.agentId}`);
 * } catch (err) {
 *   console.error("Registration failed:", err);
 * }
 * ```
 */
export async function registerAgent(
  options: RegisterAgentOptions
): Promise<RegistrationResult> {
  const { name, description, privateKey, walletAddress } = options;
  const network = getActiveNetwork();
  const config = getNetworkConfig(network);

  console.log(`[registry] Registering agent "${name}" on ERC-8004 (${network})...`);

  // Get the RPC URL
  const rpcUrl = getRpcUrl();

  // Initialize the SDK with chain configuration and the agent's private key.
  // To switch to Pinata IPFS mode:
  // 1. Set PINATA_JWT in your .env
  // 2. Add `ipfs: "pinata"` and `pinataJwt: process.env.PINATA_JWT` below
  // 3. Change `agent.registerHTTP(...)` to `agent.registerIPFS()` below
  const sdk = new SDK({
    chainId: config.chainId,
    rpcUrl,
    privateKey,
    // ipfs: "pinata",                    // Uncomment for IPFS mode
    // pinataJwt: process.env.PINATA_JWT, // Uncomment for IPFS mode
  });

  // Create the agent metadata
  const agent = sdk.createAgent(name, description);

  // Register using HTTP mode (default — no IPFS required)
  // For IPFS mode, replace this with: const handle = await agent.registerIPFS();
  const agentHttpUri = `https://8004scan.com/api/agent/${walletAddress}`;
  const handle = await agent.registerHTTP(agentHttpUri);

  // Wait for the transaction to be mined
  await handle.waitMined();
  const agentId = agent.agentId ?? "unknown";
  const txHash = handle.hash ?? "unknown";

  console.log(`[registry] Agent registered successfully.`);
  console.log(`[registry]   Agent ID: ${agentId}`);
  console.log(`[registry]   TX Hash: ${txHash}`);
  console.log(`[registry]   View on 8004scan: https://8004scan.com/agent/${agentId}`);

  return { agentId: String(agentId), txHash: String(txHash) };
}

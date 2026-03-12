# API Reference

All functions and types are exported from the package root. Import with:

```ts
import { runAgent, getProvider, ... } from "web3agent-sdk";
```

---

## Configuration

### `getActiveNetwork(): NetworkName`

Returns the active network name from the `NETWORK` environment variable. Defaults to `"arbitrum-sepolia"`.

**Throws**: If `NETWORK` is set to an unsupported value.

```ts
const network = getActiveNetwork(); // "arbitrum-sepolia"
```

### `getNetworkConfig(network?: NetworkName): NetworkConfig`

Returns the configuration object for a network.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `network` | `NetworkName` | Active network | Network to get config for |

```ts
const config = getNetworkConfig("arbitrum-one");
// { name: "Arbitrum One", chainId: 42161, ... }
```

### `getProvider(network?: NetworkName): ethers.JsonRpcProvider`

Returns an ethers `JsonRpcProvider` for the specified network.

**Throws**: If the required Alchemy API key env var is not set.

```ts
const provider = getProvider();
const blockNumber = await provider.getBlockNumber();
```

### `getChainId(network?: NetworkName): number`

Returns the chain ID for a network.

```ts
const chainId = getChainId(); // 421614
```

---

## Wallet Management

### `getOrCreateAgentWallet(options: WalletOptions): WalletData`

Creates or loads an isolated wallet for an agent.

| Param | Type | Description |
|-------|------|-------------|
| `options.agentName` | `string` | Unique agent name (used as directory name) |

**Returns**: `{ address: string, privateKey: string }`

**Caveat**: The `wallet.json` file contains a raw private key. Never commit it.

```ts
const wallet = getOrCreateAgentWallet({ agentName: "my-agent" });
console.log(wallet.address);
```

### `getMasterWallet(): ethers.Wallet`

Returns the master wallet connected to the active network's provider.

**Throws**: If `MASTER_PRIVATE_KEY` is not set.

```ts
const master = getMasterWallet();
console.log(master.address);
```

### `getMasterWalletBalance(): Promise<string>`

Returns the master wallet's ETH balance as a human-readable string.

```ts
const balance = await getMasterWalletBalance();
console.log(`${balance} ETH`);
```

### `fundAgentWallet(options: FundAgentOptions): Promise<string>`

Sends ETH from the master wallet to an agent wallet.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `options.agentAddress` | `string` | — | Agent wallet address |
| `options.amountEth` | `string` | `"0.001"` | Amount of ETH to send |

**Returns**: The transaction hash.

**Throws**: If master wallet balance is insufficient.

```ts
const txHash = await fundAgentWallet({
  agentAddress: wallet.address,
  amountEth: "0.002",
});
```

---

## Agent Orchestration

### `runAgent(options: RunAgentOptions): Promise<AgentRunResult>`

Runs an autonomous agent with Claude Sonnet and the specified skills.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `options.task` | `string` | — | Natural-language task |
| `options.privateKey` | `string` | — | Agent's private key for signing |
| `options.skills` | `string[]` | `[]` | Skill names to attach (max 3) |
| `options.streaming` | `boolean` | `false` | Enable streaming output |

**Returns**: `{ output: string, steps: string[] }`

**Throws**: If `ANTHROPIC_API_KEY` is not set. If more than 3 skills are requested.

```ts
const result = await runAgent({
  task: "Swap 0.001 WETH for USDC",
  privateKey: wallet.privateKey,
  skills: ["uniswap-swap"],
});
console.log(result.output);
```

---

## ERC-8004 Registration

### `registerAgent(options: RegisterAgentOptions): Promise<RegistrationResult>`

Registers an agent on the ERC-8004 Identity Registry.

| Param | Type | Description |
|-------|------|-------------|
| `options.name` | `string` | Agent display name |
| `options.description` | `string` | Short description |
| `options.privateKey` | `string` | Agent's private key |
| `options.walletAddress` | `string` | Agent's wallet address |

**Returns**: `{ agentId: string, txHash: string }`

**Caveat**: The `@blockbyvlog/agent0-sdk` is in alpha. Always wrap in try/catch.

```ts
try {
  const reg = await registerAgent({
    name: "my-agent",
    description: "Swaps tokens on Uniswap",
    privateKey: wallet.privateKey,
    walletAddress: wallet.address,
  });
  console.log(`Agent #${reg.agentId}`);
} catch (err) {
  console.error("Registration failed:", err);
}
```

---

## Skills

### `listSkills(): string[]`

Returns all registered skill names.

```ts
const skills = listSkills(); // ["uniswap-swap"]
```

### `resolveSkills(skillNames: string[], agentPrivateKey: string): DynamicStructuredTool[]`

Resolves skill names to LangChain tool instances.

**Throws**: If a skill name is unknown. If more than 3 skills are requested.

```ts
const tools = resolveSkills(["uniswap-swap"], wallet.privateKey);
```

### `createUniswapSwapSkill(agentPrivateKey: string): DynamicStructuredTool`

Creates a Uniswap V3 swap tool directly (bypassing the registry).

```ts
const tool = createUniswapSwapSkill(wallet.privateKey);
```

---

## Types

| Type | Description |
|------|-------------|
| `NetworkName` | `"arbitrum-sepolia" \| "arbitrum-one" \| "robinhood-testnet"` |
| `NetworkConfig` | Network configuration entry |
| `WalletData` | `{ address, privateKey }` |
| `WalletOptions` | `{ agentName }` |
| `FundAgentOptions` | `{ agentAddress, amountEth? }` |
| `RegisterAgentOptions` | `{ name, description, privateKey, walletAddress }` |
| `RegistrationResult` | `{ agentId, txHash }` |
| `RunAgentOptions` | `{ task, privateKey, skills?, streaming? }` |
| `AgentRunResult` | `{ output, steps }` |
| `SwapInput` | `{ tokenIn, tokenOut, amount, feeTier }` |
| `SwapResult` | `{ success, txHash?, error? }` |
| `SkillFactory` | `(agentPrivateKey: string) => DynamicStructuredTool` |

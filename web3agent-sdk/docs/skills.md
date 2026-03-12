# Skills

Skills are LangChain `DynamicStructuredTool` instances that give agents the ability to execute onchain actions. Each skill is a factory function that accepts the agent's private key and returns a tool.

## Built-in skills

### uniswap-swap

Executes a token swap on Uniswap V3 using the `exactInputSingle` function on SwapRouter02.

**Parameters** (provided by the agent during execution):

| Param | Type | Description |
|-------|------|-------------|
| `tokenIn` | `string` | Address of the token to sell |
| `tokenOut` | `string` | Address of the token to buy |
| `amount` | `string` | Human-readable amount to swap (e.g. `"0.001"`) |
| `feeTier` | `number` | Fee tier in basis points (`500`, `3000`, `10000`) |

**What it does**:

1. Reads the token's decimals
2. Checks and sets ERC-20 approval for the SwapRouter
3. Calls `exactInputSingle` on SwapRouter02 (`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`)
4. Returns `{ success: true, txHash }` or `{ success: false, error }`

**Usage**:

```ts
const result = await runAgent({
  task: "Swap 0.001 WETH for USDC",
  privateKey: wallet.privateKey,
  skills: ["uniswap-swap"],
});
```

**Caveats**:

- `amountOutMinimum` is set to 0 for testnet simplicity. For mainnet, this must be replaced with real slippage protection.
- The SwapRouter02 address is the same on Arbitrum Sepolia and Arbitrum One.

## Creating a new skill

### Step 1: Create the skill module

Create a new file in `src/skills/` (e.g., `src/skills/aave-lend.ts`):

```ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ethers } from "ethers";
import { getProvider } from "../config.js";

/**
 * Creates an Aave V3 lending skill.
 *
 * @param agentPrivateKey - The agent's private key for signing transactions.
 * @returns A LangChain DynamicStructuredTool for Aave lending.
 */
export function createAaveLendSkill(agentPrivateKey: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "aave-lend",
    description: "Supply tokens to Aave V3 to earn yield.",
    schema: z.object({
      token: z.string().describe("Address of the token to supply"),
      amount: z.string().describe("Human-readable amount to supply"),
    }),
    func: async ({ token, amount }): Promise<string> => {
      const provider = getProvider();
      const wallet = new ethers.Wallet(agentPrivateKey, provider);

      // ... implement Aave V3 supply logic here ...

      return JSON.stringify({ success: true, txHash: "0x..." });
    },
  });
}
```

### Step 2: Register the skill

In `src/skills/index.ts`, import and add to the registry:

```ts
import { createAaveLendSkill } from "./aave-lend.js";

const SKILL_REGISTRY: Record<string, SkillFactory> = {
  "uniswap-swap": createUniswapSwapSkill,
  "aave-lend": createAaveLendSkill, // Add this line
};
```

### Step 3: Use it

```ts
const result = await runAgent({
  task: "Supply 100 USDC to Aave",
  privateKey: wallet.privateKey,
  skills: ["aave-lend"],
});
```

No changes to the orchestrator are needed. The skill registry handles name-to-tool resolution automatically.

### Skill rules

- Maximum 3 skills per agent run
- Skill names must be unique in the registry
- The factory function receives the agent's private key — use it to sign transactions
- Return structured JSON from the tool's `func` so the agent can parse results
- Add JSDoc to the factory function

# web3agent / actions

![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![LangChain](https://img.shields.io/badge/LangChain-tools-green)
![Arbitrum One](https://img.shields.io/badge/Arbitrum%20One-42161-9cf)

Composable onchain actions for AI agents on Arbitrum. Tools, skills, and dynamic ABI bindings built on LangChain and viem.

> **WARNING: This is experimental software. Not for production use.** Use at your own risk. Do not use with real funds without fully understanding the code.

## Architecture

Three levels of abstraction, pick the one that fits your use case:

```
┌─────────────────────────────────────────────┐
│              Level 1: Actions               │
│         (skill + tools, production)         │
│                                             │
│           TransferEthAction()                   │
└──────────────┬──────────────────┬───────────┘
               │                  │
   ┌───────────▼──────┐ ┌────────▼─────────┐
   │  Skills           │ │  Tools           │  ← Level 2
   │  (reasoning)      │ │  (execution)     │
   └──────────────────┘ └──────────────────┘
                                │
              ┌─────────────────▼──────────────┐
              │  Level 3: Dynamic               │
              │  fetch_contract_abi             │
              │  call_contract                  │
              └────────────────────────────────┘
```

**Level 1 — Actions** are opinionated bundles of tools + skill. Import an action, hand it to your agent, and go.

**Level 2 — Tools** are individual `DynamicStructuredTool` instances. Pure execution, no reasoning layer. For advanced developers who want to compose their own agent logic.

**Level 3 — Dynamic** is a generic ABI-based tool factory. Pass any contract ABI and get usable LangChain tools back. For exploration and prototyping.

## Quickstart

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { ChatAnthropic } from "@langchain/anthropic"
import { TransferEthAction } from "web3agent/actions"

const transfer = TransferEthAction()

const llm = new ChatAnthropic({ modelName: "claude-sonnet-4-20250514" })
const agent = createReactAgent({
  llm,
  tools: transfer.tools, // includes send_eth + get_token_balance
})

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is my ETH balance?" }],
})
```

## Using with LangChain

Extract tools from an action and inject the skill context into your system prompt:

```typescript
import { TransferEthAction } from "web3agent/actions"

const transfer = TransferEthAction()

// Use tools with any LangChain agent (send_eth + get_token_balance)
const tools = transfer.tools

// Inject skill context into the system prompt
const systemPrompt = `You are an onchain agent.\n\n${transfer.skill.context}`
```

## Available actions

| Action            | Tools included                  | Description                                              |
|-------------------|---------------------------------|----------------------------------------------------------|
| `TransferEthAction()` | `send_eth`, `get_token_balance` | Transfer ETH with balance checks and safety confirmations |

## Using tools directly (Level 2)

Import individual tools without the skill wrapper:

```typescript
import { sendEthTool, tokenBalanceTool } from "web3agent/actions"

// Use directly with a LangChain agent
const tools = [sendEthTool, tokenBalanceTool]

// Or invoke manually
const balance = await tokenBalanceTool.invoke({
  address: "0x742d35Cc6634C0532925a3b8D4C9C4A3b5C09d21",
})
```

## Dynamic contract tools (Level 3)

Two tools that let the agent discover and call any verified contract at runtime, no pre-configuration needed:

```typescript
import { fetchContractAbiTool, callContractTool } from "web3agent/actions"

// Give both tools to your agent
const tools = [fetchContractAbiTool, callContractTool]
```

The agent autonomously:
1. Calls `fetch_contract_abi` with a contract address to see its functions
2. Calls `call_contract` with the address, function name, and args to execute

Works with any verified contract on Arbiscan. Read calls (view/pure) return the result. Write calls (nonpayable/payable) return the tx hash.

Set `ARBISCAN_API_KEY` for higher rate limits (optional).

## Creating a custom action

### Step 1: Create the tool

```typescript
// actions/tools/my-tool.tool.ts
import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"

export const myTool = new DynamicStructuredTool({
  name: "my_tool",
  description: "Does something onchain",
  schema: z.object({
    param: z.string().describe("A parameter"),
  }),
  func: async ({ param }): Promise<string> => {
    try {
      // Your viem logic here
      return `Success: ${param}`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  },
})
```

### Step 2: Create the skill

```typescript
// actions/skills/my-tool.skill.ts
import type { Skill } from "../types"

export const myToolSkill: Skill = {
  name: "my-tool",
  description: "Guidance for using my-tool",
  context: `
    When using my-tool:
    - Always validate input before calling
    - Return results clearly
  `,
}
```

### Step 3: Compose the action in index.ts

```typescript
import { myTool } from "./tools/my-tool.tool"
import { myToolSkill } from "./skills/my-tool.skill"
import type { Action } from "./types"

export const MyToolAction = (): Action => ({
  name: "my-tool",
  description: "My custom onchain action",
  tools: [myTool],
  skill: myToolSkill,
})
```

## API reference

### `Skill`

Prompt context injected into the agent system prompt. Defines when and how to use tools.

| Field         | Type       | Description                                      |
|---------------|------------|--------------------------------------------------|
| `name`        | `string`   | Skill identifier                                 |
| `description` | `string`   | Short description of the skill's purpose         |
| `context`     | `string`   | Injected verbatim into the agent system prompt   |
| `examples`    | `Array`    | Optional usage examples (user, thought, action)  |

### `Action`

Composable unit combining tools + skill. Level 1 of the actions architecture.

| Field         | Type                      | Description                          |
|---------------|---------------------------|--------------------------------------|
| `name`        | `string`                  | Action identifier                    |
| `description` | `string`                  | Short description                    |
| `tools`       | `DynamicStructuredTool[]` | Tools included in this action        |
| `skill`       | `Skill`                   | Reasoning context for the agent      |

## Contributing

Contributions are welcome. To add a new action, create the tool in `tools/`, the skill in `skills/`, and compose them as a factory function in `index.ts`. All tools must use `viem` for onchain interactions, `zod` for schemas, and must never throw, always return a string. Run `tsc --noEmit` and `vitest` before submitting.

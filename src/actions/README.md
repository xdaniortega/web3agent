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

**Level 1 — Actions** are opinionated bundles of tools + skill. Import an action, hand it to your agent, and go. This is the recommended starting point for most developers.

**Level 2 — Tools** are individual `DynamicStructuredTool` instances. Pure execution, no reasoning layer. The tool handles what to do (send ETH, check a balance), but not when or why. For advanced developers who want to compose their own agent logic.

**Level 3 — Dynamic** is a generic ABI-based tool factory. Pass any contract ABI and get usable LangChain tools back. For exploration and prototyping.

### How actions work at runtime

When an agent loads an Action, two things happen:

1. **Tools** are registered with the LangChain agent — the LLM can call them during execution.
2. **Skill context** is injected verbatim into the agent's system prompt — this gives the LLM reasoning guidance about *when* and *how* to use those tools.

The Skill is not executable code. It's prompt engineering packaged alongside the tools it describes. This is what separates an Action from a bare tool: the agent doesn't just know it *can* send ETH, it knows it *should* check the balance first and only ask for confirmation above 0.1 ETH.

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

## Actions vs MCP (Model Context Protocol)

A common question is whether this actions system should be replaced by or aligned with [MCP](https://modelcontextprotocol.io). Short answer: **they solve different problems at different layers of the stack.**

```
┌──────────────────────────────────────────────┐
│  Actions       (what + how to reason)        │  ← Agent behavior design
├──────────────────────────────────────────────┤
│  Tools         (what to execute)             │  ← Business logic (viem, Zod)
├──────────────────────────────────────────────┤
│  Transport     (how to discover & invoke)    │  ← MCP lives here
└──────────────────────────────────────────────┘
```

### What Actions do that MCP doesn't

Actions are an **agent behavior composition** layer. An Action bundles execution (Tools) with reasoning guidance (Skills) into a single unit that shapes how an LLM thinks and acts. MCP has no equivalent concept for:

- **Skills** — prompt context that teaches the LLM *when* and *why* to use a tool, not just *how*. MCP tools have descriptions, but not structured reasoning guidance with examples.
- **Action bundles** — curated groupings of tools that belong together (e.g., `send_eth` + `get_token_balance` as a single `TransferEthAction`). MCP exposes flat tool lists.
- **Agent-level configuration** — which actions an agent has selected, stored in an ERC-8004 compliant config.

### What MCP does that Actions don't

MCP is a **transport protocol** for tool discovery and invocation across process boundaries. It solves problems Actions don't address:

- **Remote tool discovery** — an agent can discover another agent's tools at runtime via `tools/list`.
- **Cross-process invocation** — tools run in a separate server process, called via JSON-RPC.
- **Inter-agent communication** — Agent A can use Agent B's tools without sharing a runtime.

Currently, all tools in this project run in-process. If Agent A wants to call Agent B's `send_eth` tool, there's no path for that today.

### How they relate

Actions and MCP are **complementary, not competing**:

- **Tools** (Level 2) are the shared primitive. A `send_eth` tool is pure execution logic — it doesn't care if it's invoked by a local LangChain agent or by a remote MCP client.
- **MCP** is a transport layer that can wrap existing tools for external consumption. An MCP server can expose the same `send_eth` tool that an Action bundles locally.
- **Actions** remain the composition layer on top. An Action could include both local tools and MCP-sourced remote tools — it doesn't care about transport.

```
TransferEthAction
  ├── skill: transferEthSkill            (local prompt context)
  ├── tool:  send_eth                    (local, in-process)
  └── tool:  price_feed                  (remote, via MCP from another agent)
```

The ERC-8004 agent config already defines `"MCP"` as a supported endpoint type, acknowledging this future. When agent-to-agent tool sharing is needed, MCP is the right transport — but it wraps the tools layer, it doesn't replace the actions layer.

### TL;DR

| Concern | Actions | MCP |
|---------|---------|-----|
| What it solves | Agent behavior composition (tools + reasoning) | Tool discovery & invocation across boundaries |
| Scope | In-process, per-agent | Cross-process, multi-agent |
| Key primitive | `Action` (Skill + Tools bundle) | `Tool` (JSON Schema + JSON-RPC handler) |
| Reasoning guidance | Yes (Skills with prompt context + examples) | No (tool descriptions only) |
| Remote tool access | No | Yes |
| Relationship | Sits above MCP — can compose MCP-sourced tools | Sits below Actions — transports tool calls |

## Contributing

Contributions are welcome. To add a new action, create the tool in `tools/`, the skill in `skills/`, and compose them as a factory function in `index.ts`. All tools must use `viem` for onchain interactions, `zod` for schemas, and must never throw, always return a string. Run `tsc --noEmit` and `vitest` before submitting.

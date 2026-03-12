# Architecture

## Module overview

```
src/
  index.ts           Public API — re-exports everything consumers need
  config.ts          Network config, Alchemy RPC provider
  wallet.ts          Agent wallet creation/loading, master wallet, funding
  orchestrator.ts    LangChain agent with Claude, skill attachment
  registry.ts        ERC-8004 Identity Registry registration
  types.ts           Shared TypeScript interfaces and types
  skills/
    index.ts         Skill registry — maps names to factory functions
    uniswap-swap.ts  Uniswap V3 exactInputSingle swap skill
```

## Data flow

```
runAgent() call
    |
    v
+------------------+
|   orchestrator    |  Creates ChatAnthropic (Claude Sonnet)
|                   |  Resolves skills from registry
|                   |  Builds a ReAct agent via LangGraph
+------------------+
    |
    v
+------------------+
|  skill registry  |  Maps skill names -> factory functions
|  (skills/index)  |  Factory receives agent private key
+------------------+        |
    |                       v
    |              +------------------+
    |              |  uniswap-swap    |  DynamicStructuredTool
    |              |  (or other skill)|  Signs TX with agent key
    |              +------------------+
    |                       |
    v                       v
+------------------+  +------------------+
|   config.ts      |  |   ethers.js      |
|   getProvider()  |->|   JsonRpcProvider |---> Arbitrum RPC (Alchemy)
+------------------+  +------------------+

Wallet lifecycle:
+------------------+     +------------------+     +------------------+
| getOrCreate      | --> | fundAgentWallet  | --> | registerAgent    |
| AgentWallet()    |     | (from master)    |     | (ERC-8004)       |
+------------------+     +------------------+     +------------------+
  Creates keypair          Master sends ETH       Registers identity
  Saves wallet.json        to agent address       on Identity Registry
```

## Key design decisions

**Single entry point**: All public API is re-exported from `src/index.ts`. Consumers import from `"web3agent-sdk"` and nothing else.

**Skill isolation**: Each skill is a factory function in its own file. The skill registry maps names to factories. Adding a skill requires no changes to the orchestrator.

**Wallet isolation**: Each agent has its own directory under `agents/` with a `wallet.json` file. Wallets are never overwritten once created.

**Dynamic SDK import**: The `@blockbyvlog/agent0-sdk` is imported dynamically in `registry.ts` to avoid hard failures if the package is missing or has interop issues.

**No streaming by default**: Streaming is disabled to keep the default behavior simple and deterministic. It can be enabled with a single flag.

**No human-in-the-loop by default**: The orchestrator uses a simple ReAct agent without interrupts. Comments in the code explain how to add LangGraph interrupts for human-in-the-loop control.

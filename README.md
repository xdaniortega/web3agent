
<div align="center">
  <h1 style="font-size: 3em; margin-bottom: 20px; margin-top: 0;">
    Create Agent
  </h1>

  <p style="font-size: 1.2em; max-width: 600px; margin: 0 auto;">
    Deploy autonomous AI agents on Arbitrum with isolated wallets, onchain skills, and ERC-8004 identity registration
  </p>

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![Claude](https://img.shields.io/badge/Powered%20by-Claude-8B5CF6.svg?style=flat-square)](https://anthropic.com)
[![Arbitrum](https://img.shields.io/badge/Network-Arbitrum-28A0F0.svg?style=flat-square)](https://arbitrum.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
</div>

> [!WARNING]
> **EXPERIMENTAL, NOT FOR PRODUCTION USE**
> Use at your own risk. Do not use with real funds without fully understanding the code.

- [Quick Start](#quick-start)
- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Setup](#setup)
- [SDK Usage](#sdk-usage)
- [Skills](#skills)
- [Networks](#networks)
- [Security](#security)
- [Documentation](#documentation)

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/anthropics/create-agent.git
cd create-agent
npm install

# 2. Configure environment
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, ALCHEMY key, and MASTER_PRIVATE_KEY

# 3. Build
npm run build

# 4. Run the end-to-end test
npm test
```

---

## What It Does

Four things, nothing else:

- **Agent orchestration** — Uses LangChain.js with Claude to run autonomous agents that reason about and execute onchain tasks.
- **Isolated wallets** — Every agent gets its own cryptographically generated wallet. Private keys are stored locally and never committed.
- **Onchain skills** — Agents can be given up to three skills (LangChain tools). Ships with a Uniswap V3 swap skill out of the box.
- **ERC-8004 identity** — Agents self-register on the ERC-8004 Identity Registry, giving them a verifiable onchain identity.

---

## Architecture

```
create-agent/
  src/
    index.ts           Public API entry point
    config.ts           Network configuration and providers
    wallet.ts           Wallet management (agent + master)
    orchestrator.ts     LangChain agent orchestration
    registry.ts         ERC-8004 registration
    types.ts            Shared TypeScript types
    skills/
      index.ts          Skill registry
      uniswap-swap.ts   Uniswap V3 swap skill
  agents/               Runtime agent data (wallets, gitignored)
  scripts/
    test-workflow.ts    End-to-end test script
  docs/                 Developer documentation
```

```
Master Wallet (funds agents)
    |
    |-- getOrCreateAgentWallet("my-agent")
    |       -> agents/my-agent/wallet.json (private key, gitignored)
    |
    |-- fundAgentWallet(agentAddress, "0.001")
    |       -> sends ETH from master to agent
    |
    |-- registerAgent({ name, description, privateKey, walletAddress })
    |       -> ERC-8004 identity on-chain
    |
    |-- runAgent({ task, privateKey, skills: ["uniswap-swap"] })
            -> LangChain + Claude executes the task autonomously
```

---

## Setup

### Prerequisites

- **Node.js 18+** (check with `node --version`)
- **An Anthropic API key** for Claude: [console.anthropic.com](https://console.anthropic.com)
- **An Alchemy account** (free): [dashboard.alchemy.com](https://dashboard.alchemy.com)
- **A funded wallet** on your target network (Sepolia ETH for testnet)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `NETWORK` | No | `arbitrum-sepolia` (default), `arbitrum-one`, or `robinhood-testnet` |
| `RPC_URL` | Yes | Full RPC endpoint URL including API key |
| `MASTER_PRIVATE_KEY` | Yes | Private key of the wallet that funds agents |

---

## SDK Usage

### Create an agent wallet

```typescript
import {
  getOrCreateAgentWallet,
  fundAgentWallet,
  registerAgent,
  runAgent,
} from "create-agent"

// Create or load an agent wallet
const wallet = await getOrCreateAgentWallet({ agentName: "my-agent" })
console.log("Agent address:", wallet.address)

// Fund the agent from the master wallet
await fundAgentWallet({
  agentAddress: wallet.address,
  amountEth: "0.001",
})
```

### Register on ERC-8004

```typescript
const registration = await registerAgent({
  name: "my-agent",
  description: "Autonomous DeFi agent on Arbitrum",
  privateKey: wallet.privateKey,
  walletAddress: wallet.address,
})
console.log("Agent ID:", registration.agentId)
```

### Run an agent

```typescript
const result = await runAgent({
  task: "Swap 0.001 ETH for USDC on Uniswap V3",
  privateKey: wallet.privateKey,
  skills: ["uniswap-swap"],
})
console.log("Output:", result.output)
console.log("Steps:", result.steps)
```

### Types

```typescript
interface WalletData {
  address: string
  privateKey: string
}

interface RunAgentOptions {
  task: string
  privateKey: string
  skills?: string[]
  streaming?: boolean
}

interface AgentRunResult {
  output: string
  steps: string[]
}
```

See the full type reference in [`docs/api-reference.md`](docs/api-reference.md).

---

## Skills

Agents can be assigned up to three skills. Each skill is a LangChain tool that the agent can invoke during execution.

| Skill | Description |
|-------|-------------|
| `uniswap-swap` | Swap tokens on Uniswap V3 |

Create custom skills by implementing a `SkillFactory` and registering it in `src/skills/index.ts`. See [`docs/skills.md`](docs/skills.md) for details.

---

## Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Arbitrum Sepolia | 421614 | Default, recommended for development |
| Arbitrum One | 42161 | Mainnet |
| Robinhood Testnet | 23888 | Experimental |

Set the active network via the `NETWORK` environment variable. See [`docs/networks.md`](docs/networks.md).

---

## Security

- **Never commit `.env` or `agents/*/wallet.json`** — both are in `.gitignore`
- The master wallet private key is used only to fund agent wallets
- Agent private keys are stored locally in `agents/<name>/wallet.json`
- Review the [Contributing](CONTRIBUTING.md) guide before submitting changes

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Quickstart](docs/quickstart.md) | Full setup walkthrough |
| [Architecture](docs/architecture.md) | How the modules fit together |
| [API Reference](docs/api-reference.md) | Every exported function and type |
| [Skills](docs/skills.md) | Using and creating skills |
| [Networks](docs/networks.md) | Supported networks and configuration |
| [ERC-8004](docs/erc8004.md) | Identity registration deep dive |
| [Contributing](CONTRIBUTING.md) | How to contribute |

---

## License

Apache 2.0, see [LICENSE](./LICENSE).

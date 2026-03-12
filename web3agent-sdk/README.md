# web3agent-sdk

Deploy autonomous AI agents on Arbitrum. Each agent holds its own isolated wallet, executes onchain DeFi actions via LangChain + Claude, and self-registers on the ERC-8004 Identity Registry.

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Copy .env.example to .env and fill in your keys
cp .env.example .env

# 3. Fund your master wallet with Sepolia ETH, then run the test
npx tsx scripts/test-workflow.ts
```

## What it does

- **Agent orchestration** — Uses LangChain.js with Claude Sonnet to run autonomous agents that reason about and execute onchain tasks.
- **Isolated wallets** — Every agent gets its own cryptographically generated wallet. Private keys are stored locally and never committed.
- **Onchain skills** — Agents can be given up to three skills (LangChain tools). Ships with a Uniswap V3 swap skill out of the box.
- **ERC-8004 identity** — Agents self-register on the ERC-8004 Identity Registry, giving them a verifiable onchain identity.
- **Multi-network** — Supports Arbitrum Sepolia, Arbitrum One, and Robinhood Testnet.

## Documentation

| Doc | Description |
|-----|-------------|
| [Quickstart](docs/quickstart.md) | Full setup walkthrough |
| [Architecture](docs/architecture.md) | How the modules fit together |
| [API Reference](docs/api-reference.md) | Every exported function and type |
| [Skills](docs/skills.md) | Using and creating skills |
| [Networks](docs/networks.md) | Supported networks and configuration |
| [ERC-8004](docs/erc8004.md) | Identity registration deep dive |
| [Contributing](docs/contributing.md) | How to contribute |

## Project structure

```
web3agent-sdk/
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

## Roadmap

This SDK is the foundation (Pill 1) of a larger Arbitrum AgentKit:

- **Pill 2** — ZeroDev smart wallets for gasless agent transactions
- **Pill 3** — A2A/MCP communication between agents
- **Pill 4** — x402 payments for agent-to-agent commerce
- **Pill 5** — Onchain reputation and trust scoring

## Security

- **Never commit `.env` or `agents/*/wallet.json`** — both are in `.gitignore`.
- The master wallet private key is used only to fund agent wallets.
- Agent private keys are stored locally in `agents/<name>/wallet.json`.
- Review the [Contributing](docs/contributing.md) guide before submitting changes.

## License

MIT

# Quickstart

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- An [Alchemy API key](https://dashboard.alchemy.com/) for Arbitrum Sepolia
- A master wallet with Sepolia ETH (for funding agent wallets)

## Step 1: Install

```bash
cd web3agent-sdk
npm install
```

## Step 2: Configure environment

```bash
cp .env.example .env
```

Fill in the required values in `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `ALCHEMY_ARBITRUM_SEPOLIA_KEY` | Yes (for Sepolia) | Alchemy API key for Arbitrum Sepolia |
| `MASTER_PRIVATE_KEY` | Yes | Private key of the master funding wallet |
| `NETWORK` | No | Defaults to `arbitrum-sepolia` |

## Step 3: Fund the master wallet

The master wallet sends small amounts of ETH to newly created agent wallets so they can pay for gas. You need Sepolia ETH.

1. Copy the master wallet address from your private key (or run the test script — it will print it)
2. Get Sepolia ETH from the [Alchemy Arbitrum Sepolia faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)
3. Wait for the transaction to confirm

You need at least 0.005 ETH in the master wallet.

## Step 4: Run the test

```bash
npx tsx scripts/test-workflow.ts
```

## What to expect

The test script will:

1. Print the active network and master wallet address
2. Check the master wallet balance (prompts you if too low)
3. Create an agent wallet (or load an existing one)
4. Fund the agent wallet with 0.002 ETH from the master
5. Register the agent on the ERC-8004 Identity Registry
6. Run the agent with the Uniswap swap skill
7. Print a summary with the agent ID and wallet address

If ERC-8004 registration fails (the SDK is in alpha), the script logs the error and continues. The swap may also fail if token addresses or liquidity conditions are not met on testnet — this is expected during initial testing.

## Next steps

- Read the [Architecture](architecture.md) to understand how modules fit together
- Read the [Skills](skills.md) guide to create your own skill
- Read the [API Reference](api-reference.md) for full function signatures

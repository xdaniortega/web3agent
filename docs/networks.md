# Networks

## Supported networks

| Network | Chain ID | Env var for Alchemy key | Default |
|---------|----------|------------------------|---------|
| `arbitrum-sepolia` | 421614 | `ALCHEMY_ARBITRUM_SEPOLIA_KEY` | Yes |
| `arbitrum-one` | 42161 | `ALCHEMY_ARBITRUM_ONE_KEY` | No |
| `robinhood-testnet` | 23888 | `ALCHEMY_ROBINHOOD_TESTNET_KEY` | No |

Note: The Robinhood Testnet chain ID (23888) should be verified before production use.

## Switching networks

Set the `NETWORK` environment variable in your `.env` file:

```bash
NETWORK=arbitrum-one
```

Or set it inline:

```bash
NETWORK=arbitrum-one npx tsx scripts/test-workflow.ts
```

If `NETWORK` is not set, it defaults to `arbitrum-sepolia`.

## Getting an Alchemy API key

1. Go to [dashboard.alchemy.com](https://dashboard.alchemy.com/)
2. Create a new app for the Arbitrum network you need
3. Copy the API key (not the full URL)
4. Set it in your `.env` file

## Getting testnet ETH

### Arbitrum Sepolia

- [Alchemy Arbitrum Sepolia Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)

### Robinhood Testnet

- Check the Robinhood Testnet documentation for faucet availability.

## Using the provider

```ts
import { getProvider, getActiveNetwork, getChainId } from "web3agent-sdk";

const provider = getProvider(); // Uses active network
const network = getActiveNetwork(); // "arbitrum-sepolia"
const chainId = getChainId(); // 421614
```

# Networks

## Supported networks

| Network | Chain ID | Default |
|---------|----------|---------|
| `arbitrum-sepolia` | 421614 | Yes |
| `arbitrum-one` | 42161 | No |
| `robinhood-testnet` | 23888 | No |

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

## Configuring the RPC endpoint

Set `RPC_URL` in your `.env` to the full endpoint URL including the API key:

```bash
RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

You can get a key from [dashboard.alchemy.com](https://dashboard.alchemy.com/) or use any compatible RPC provider.

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

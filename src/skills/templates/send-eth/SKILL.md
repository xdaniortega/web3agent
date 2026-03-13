---
name: send-eth
description: Send ETH from the agent wallet to any address on Arbitrum Sepolia
---

Use this skill to send ETH to a destination address.

- toAddress: the recipient wallet address (0x...)
- amount: the amount in ETH as a string (e.g. "0.001")
- The skill checks balance before sending and returns a clear error if insufficient.
- Returns txHash and blockNumber on success.

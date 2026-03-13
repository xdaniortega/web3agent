---
name: send-eth
description: Send ETH from the agent wallet to any address
---

Use this skill to send ETH to a destination address.

- Provide the recipient address and amount in ETH (e.g. "0.001").
- The transaction is signed with the agent's private key.
- Waits for onchain confirmation before returning.
- Returns the transaction hash on success.

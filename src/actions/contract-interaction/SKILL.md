---
name: contract-interaction
description: Discover and call functions on any verified smart contract. Use when the user wants to interact with a contract, read contract state, or execute contract functions.
license: Apache-2.0
allowed-tools: fetch_contract_abi call_contract
metadata:
  author: blockbyvlog
  version: "1.0"
---

# Contract Interaction

You have two tools: `fetch_contract_abi` and `call_contract`.

## Two-Step Flow

### Step 1: Discover Functions
Use `fetch_contract_abi` to see what functions a contract exposes.
- Returns a numbered list of callable functions with their signatures
- Shows input types, output types, and mutability (view/pure/payable/nonpayable)

### Step 2: Call a Function
Use `call_contract` to execute any function on the contract.
- For view/pure functions: returns the result (no gas cost)
- For state-changing functions: returns the transaction hash
- Args must be passed as a JSON array string

## Critical Rules
- **ALWAYS** call `fetch_contract_abi` first to understand the contract before calling functions
- The contract must be verified on the block explorer (Arbiscan)
- For payable functions, specify the ETH value in wei
- Integer arguments are coerced to BigInt automatically
- Set `ARBISCAN_API_KEY` for higher rate limits

## Examples

### Read contract state
**User:** "What's the total supply of this token at 0x..."
**Approach:** 1) `fetch_contract_abi` to see functions 2) `call_contract` with functionName='totalSupply'

### Write to contract
**User:** "Approve 100 USDC for 0x..."
**Approach:** 1) `fetch_contract_abi` to verify the approve function 2) `call_contract` with functionName='approve', args='["0x...", "100000000"]'

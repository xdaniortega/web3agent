/**
 * ZeroDev Kernel smart wallet creation with ERC-7702 + ERC-4337.
 *
 * Creates a Kernel smart account that upgrades the agent's EOA via EIP-7702
 * delegation, then uses 4337 bundler + paymaster for gasless operations.
 *
 * @module smart-wallet
 */

import { createPublicClient, http } from "viem";
import type { PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import {
  KERNEL_V3_3,
  KernelVersionToAddressesMap,
  getEntryPoint,
} from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { getZeroDevConfig } from "./zerodev-config.js";
import type { SmartWalletResult, SmartWalletOptions } from "./types.js";

const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_3;
const kernelAddresses = KernelVersionToAddressesMap[kernelVersion];

/**
 * Creates a ZeroDev Kernel smart wallet using ERC-7702 + ERC-4337.
 *
 * The agent's EOA signs an authorization delegating its code to the Kernel
 * implementation. After this, the EOA itself IS the smart account (same address).
 * Transactions use the 4337 bundler + paymaster for gasless execution.
 *
 * @param options - Smart wallet creation options.
 * @returns The smart wallet result with client, validator, and public client.
 */
export async function createSmartWallet(
  options: SmartWalletOptions
): Promise<SmartWalletResult> {
  const { privateKey } = options;
  const config = getZeroDevConfig();

  const publicClient = createPublicClient({
    transport: http(config.rpcUrl),
    chain: config.chain,
  });

  // The EOA that will delegate its code to Kernel via EIP-7702.
  // With 7702, this address IS the smart account — no separate address.
  const hexKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const signer = privateKeyToAccount(hexKey);

  // Sign the 7702 authorization — EOA delegates code to Kernel implementation
  console.log("[smart-wallet] Signing EIP-7702 authorization...");
  const authorization = await signer.signAuthorization({
    chainId: config.chain.id,
    nonce: 0,
    address: kernelAddresses.accountImplementationAddress,
  });

  // Create ECDSA validator for the Kernel account
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion,
  });

  // Create the 7702 Kernel account — EOA becomes the smart account
  const account = await createKernelAccount(publicClient, {
    eip7702Account: signer,
    eip7702Auth: authorization,
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion,
  });

  // Paymaster sponsors gas costs
  const paymasterClient = createZeroDevPaymasterClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Kernel client with bundler + paymaster
  const kernelClient = createKernelAccountClient({
    account,
    chain: config.chain,
    bundlerTransport: http(config.rpcUrl),
    client: publicClient,
    paymaster: {
      getPaymasterData: (userOperation) =>
        paymasterClient.sponsorUserOperation({ userOperation }),
    },
  });

  console.log(`[smart-wallet] ERC-7702 Kernel account ready: ${account.address}`);

  return {
    address: account.address,
    client: kernelClient,
    ecdsaValidator,
    publicClient: publicClient as PublicClient,
    network: config.network,
  };
}

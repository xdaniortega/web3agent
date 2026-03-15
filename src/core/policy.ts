/**
 * Spending policies and session key management for agent smart wallets.
 *
 * Generates constrained session keys that limit what an agent can do
 * on-chain: spending caps, operation limits, expiry, and target restrictions.
 * All policy enforcement happens on-chain through Kernel's permission system.
 *
 * @module policy
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createKernelAccount, addressToEmptyAccount } from "@zerodev/sdk";
import { KERNEL_V3_3, getEntryPoint } from "@zerodev/sdk/constants";
import {
  toPermissionValidator,
  serializePermissionAccount,
} from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import {
  toCallPolicy,
  CallPolicyVersion,
  toGasPolicy,
  toRateLimitPolicy,
  toTimestampPolicy,
  toSudoPolicy,
} from "@zerodev/permissions/policies";
import type { SmartWalletResult } from "./types.js";

const entryPoint = getEntryPoint("0.7");

/**
 * Configuration for a session key policy.
 * All fields are optional; omit a constraint to leave it unrestricted.
 */
export interface PolicyConfig {
  /** Unix timestamp after which the session key is invalid. */
  expiresAt?: number;
  /** Maximum native ETH spend in wei for the entire session. */
  nativeSpendingLimit?: bigint;
  /** Maximum number of UserOps this session key can submit. */
  maxUses?: number;
  /** Restrict which contract addresses this key can call. */
  allowedTargets?: `0x${string}`[];
}

/** Named policy presets for common use cases. */
export type PolicyPreset = "conservative" | "standard" | "unrestricted";

/** The result of applying a policy — passed to the agent runtime. */
export interface PolicySession {
  /** The session key EOA address (safe to log). */
  address: `0x${string}`;
  /** Serialized approval string for agent runtime. */
  serialized: string;
  /** The session private key. Keep secret. */
  privateKey: `0x${string}`;
  /** The policy configuration that was applied. */
  policy: PolicyConfig;
  /** When this session key expires (ISO string for readability). */
  expiresAt?: string;
}

/** Named policy presets with sensible defaults. */
export const POLICY_PRESETS: Record<PolicyPreset, PolicyConfig> = {
  conservative: {
    nativeSpendingLimit: BigInt("10000000000000000"), // 0.01 ETH
    maxUses: 10,
  },
  standard: {
    nativeSpendingLimit: BigInt("500000000000000000"), // 0.5 ETH
    maxUses: 100,
  },
  unrestricted: {},
};

const VALID_PRESETS = new Set<string>(Object.keys(POLICY_PRESETS));

function resolveConfig(config: PolicyConfig | PolicyPreset): PolicyConfig {
  if (typeof config === "string") {
    if (!VALID_PRESETS.has(config)) {
      throw new Error(
        `Unknown policy preset: "${config}". Valid presets: ${[...VALID_PRESETS].join(", ")}`
      );
    }
    return POLICY_PRESETS[config];
  }
  return config;
}

/**
 * Applies a spending policy to an agent smart wallet by creating a constrained session key.
 *
 * The session key is created off-chain (no gas cost). It becomes active
 * immediately and can be used by the agent runtime autonomously within
 * the defined constraints. All enforcement is on-chain via Kernel permissions.
 *
 * @param wallet - The smart wallet to apply the policy to.
 * @param config - Policy configuration or preset name.
 * @returns The policy session with session key credentials.
 */
export async function applyPolicy(
  wallet: SmartWalletResult,
  config: PolicyConfig | PolicyPreset
): Promise<PolicySession> {
  const resolved = resolveConfig(config);

  const sessionPrivateKey = generatePrivateKey();
  const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);

  // Build policies array from config
  const policies = [];

  if (resolved.allowedTargets && resolved.allowedTargets.length > 0) {
    policies.push(
      toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: resolved.allowedTargets.map((target) => ({
          target,
        })),
      })
    );
  }

  if (resolved.nativeSpendingLimit !== undefined) {
    policies.push(toGasPolicy({ allowed: resolved.nativeSpendingLimit }));
  }

  if (resolved.maxUses !== undefined) {
    policies.push(toRateLimitPolicy({ count: resolved.maxUses, interval: 0 }));
  }

  if (resolved.expiresAt !== undefined) {
    policies.push(
      toTimestampPolicy({ validUntil: resolved.expiresAt, validAfter: 0 })
    );
  }

  // If no constraints were specified, use sudo policy (unrestricted)
  if (policies.length === 0) {
    policies.push(toSudoPolicy({}));
  }

  const emptyAccount = addressToEmptyAccount(sessionKeyAccount.address);
  const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount });

  const permissionPlugin = await toPermissionValidator(wallet.publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_3,
    signer: emptySessionKeySigner,
    policies,
  });

  const sessionKeyKernelAccount = await createKernelAccount(wallet.publicClient, {
    plugins: {
      sudo: wallet.ecdsaValidator,
      regular: permissionPlugin,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_3,
  });

  const serialized = await serializePermissionAccount(
    sessionKeyKernelAccount,
    sessionPrivateKey
  );

  console.log(`[policy] Session key created: ${sessionKeyAccount.address}`);

  return {
    address: sessionKeyAccount.address,
    serialized,
    privateKey: sessionPrivateKey,
    policy: resolved,
    expiresAt: resolved.expiresAt
      ? new Date(resolved.expiresAt * 1000).toISOString()
      : undefined,
  };
}

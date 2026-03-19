// SPDX-License-Identifier: Apache-2.0

/**
 * @notice Shared token addresses and chain config for Uniswap integrations.
 * Used by both V3 and V4 skills and tools.
 */

export interface TokenConfig {
  name: string
  weth: `0x${string}`
  usdc: `0x${string}`
  usdt: `0x${string}`
  explorer: string
}

export const TOKEN_CONFIG: Record<number, TokenConfig> = {
  // Arbitrum One (mainnet)
  42161: {
    name: "Arbitrum One",
    weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    explorer: "https://arbiscan.io/tx",
  },
  // Arbitrum Sepolia (testnet)
  421614: {
    name: "Arbitrum Sepolia",
    weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    usdt: "0x0000000000000000000000000000000000000000",
    explorer: "https://sepolia.arbiscan.io/tx",
  },
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`

/**
 * Resolves a token input: "ETH" or zero address → WETH address.
 * Returns whether the original was native ETH.
 */
export function resolveToken(
  token: string,
  weth: `0x${string}`
): { address: `0x${string}`; isNative: boolean } {
  const lower = token.toLowerCase()
  if (lower === ZERO_ADDRESS || lower === "eth") {
    return { address: weth, isNative: true }
  }
  return { address: token as `0x${string}`, isNative: false }
}

/**
 * Sorts two token addresses for V4 PoolKey (currency0 < currency1).
 * Native ETH (zero address) is always currency0.
 */
export function sortTokens(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  isNativeA: boolean,
  isNativeB: boolean,
): { currency0: `0x${string}`; currency1: `0x${string}`; zeroForOne: boolean } {
  const addrA = isNativeA ? ZERO_ADDRESS : tokenA
  const addrB = isNativeB ? ZERO_ADDRESS : tokenB
  const aLower = addrA.toLowerCase()
  const bLower = addrB.toLowerCase()

  if (aLower < bLower) {
    return { currency0: addrA, currency1: addrB, zeroForOne: true }
  }
  return { currency0: addrB, currency1: addrA, zeroForOne: false }
}

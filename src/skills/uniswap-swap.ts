/**
 * Uniswap V3 token swap skill.
 *
 * This skill allows an agent to execute a token swap via Uniswap V3's
 * SwapRouter02 contract. It handles ERC-20 approval and the swap call.
 *
 * @module skills/uniswap-swap
 */

import { ethers } from "ethers";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProvider } from "../config.js";
import type { SwapResult } from "../types.js";

/**
 * Uniswap V3 SwapRouter02 address.
 * Same on Arbitrum Sepolia and Arbitrum One.
 */
const SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

/** Minimal ERC-20 ABI for approve() and allowance(). */
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

/** Minimal SwapRouter02 ABI for exactInputSingle(). */
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

/**
 * Creates a Uniswap V3 swap skill as a LangChain DynamicStructuredTool.
 *
 * The returned tool can be attached to the agent orchestrator. It accepts
 * tokenIn, tokenOut, amount, and feeTier as inputs and executes an
 * exactInputSingle swap on the Uniswap V3 SwapRouter02.
 *
 * @param agentPrivateKey - The agent's private key for signing transactions.
 * @returns A LangChain DynamicStructuredTool that executes Uniswap V3 swaps.
 *
 * @example
 * ```ts
 * const swapTool = createUniswapSwapSkill("0xabc...");
 * // Attach to orchestrator via runAgent({ skills: ["uniswap-swap"], ... })
 * ```
 */
export function createUniswapSwapSkill(agentPrivateKey: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "uniswap-swap",
    description:
      "Execute a token swap on Uniswap V3. Provide the tokenIn address, tokenOut address, " +
      "a human-readable amount of tokenIn to swap, and the fee tier in basis points (e.g. 3000 for 0.3%).",
    schema: z.object({
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amount: z.string().describe("Human-readable amount of tokenIn to swap (e.g. '0.001')"),
      feeTier: z.number().describe("Fee tier in basis points (e.g. 500, 3000, 10000)"),
    }),
    func: async ({ tokenIn, tokenOut, amount, feeTier }): Promise<string> => {
      const result = await executeSwap(agentPrivateKey, {
        tokenIn,
        tokenOut,
        amount,
        feeTier,
      });
      return JSON.stringify(result);
    },
  });
}

/**
 * Executes a Uniswap V3 exactInputSingle swap.
 *
 * @internal
 */
async function executeSwap(
  agentPrivateKey: string,
  input: { tokenIn: string; tokenOut: string; amount: string; feeTier: number }
): Promise<SwapResult> {
  try {
    const provider = getProvider();
    const wallet = new ethers.Wallet(agentPrivateKey, provider);

    // Get token decimals
    const tokenInContract = new ethers.Contract(input.tokenIn, ERC20_ABI, wallet);
    const decimals = await tokenInContract.decimals();
    const amountIn = ethers.parseUnits(input.amount, decimals);

    // Approve SwapRouter to spend tokenIn if allowance is insufficient
    const currentAllowance: bigint = await tokenInContract.allowance(
      wallet.address,
      SWAP_ROUTER_ADDRESS
    );
    if (currentAllowance < amountIn) {
      console.log("[uniswap-swap] Approving SwapRouter to spend tokenIn...");
      const approveTx = await tokenInContract.approve(SWAP_ROUTER_ADDRESS, amountIn);
      await approveTx.wait();
      console.log(`[uniswap-swap] Approval confirmed. TX: ${approveTx.hash}`);
    }

    // Execute the swap
    const router = new ethers.Contract(SWAP_ROUTER_ABI[0] ? SWAP_ROUTER_ADDRESS : SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, wallet);

    // WARNING: amountOutMinimum is set to 0 for testnet simplicity.
    // For mainnet / production use, this MUST be replaced with real slippage
    // protection (e.g., query a price oracle and set a minimum acceptable output).
    const swapParams = {
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      fee: input.feeTier,
      recipient: wallet.address,
      amountIn: amountIn,
      amountOutMinimum: 0, // TESTNET ONLY — replace with slippage-protected value for mainnet
      sqrtPriceLimitX96: 0,
    };

    console.log("[uniswap-swap] Executing swap...");
    const tx = await router.exactInputSingle(swapParams);
    const receipt = await tx.wait();

    console.log(`[uniswap-swap] Swap executed. TX: ${receipt.hash}`);
    return { success: true, txHash: receipt.hash };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[uniswap-swap] Swap failed: ${message}`);
    return { success: false, error: message };
  }
}

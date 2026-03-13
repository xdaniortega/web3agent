/**
 * Uniswap V3 token swap skill.
 */

import { ethers } from "ethers";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProvider } from "../../../../src/core/config.js";

const SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

export function createSkill(agentPrivateKey: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "uniswap-swap",
    description:
      "Execute a token swap on Uniswap V3. Provide tokenIn address, tokenOut address, " +
      "a human-readable amount to swap, and the fee tier in basis points (e.g. 3000 for 0.3%).",
    schema: z.object({
      tokenIn: z.string().describe("Address of the token to sell"),
      tokenOut: z.string().describe("Address of the token to buy"),
      amount: z.string().describe("Human-readable amount of tokenIn to swap (e.g. '0.001')"),
      feeTier: z.number().describe("Fee tier in basis points (e.g. 500, 3000, 10000)"),
    }),
    func: async ({ tokenIn, tokenOut, amount, feeTier }): Promise<string> => {
      try {
        const provider = getProvider();
        const wallet = new ethers.Wallet(agentPrivateKey, provider);

        const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, wallet);
        const decimals = await tokenInContract.decimals();
        const amountIn = ethers.parseUnits(amount, decimals);

        const currentAllowance: bigint = await tokenInContract.allowance(
          wallet.address,
          SWAP_ROUTER_ADDRESS
        );
        if (currentAllowance < amountIn) {
          console.log("[uniswap-swap] Approving SwapRouter...");
          const approveTx = await tokenInContract.approve(SWAP_ROUTER_ADDRESS, amountIn);
          await approveTx.wait();
        }

        const router = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, wallet);
        const tx = await router.exactInputSingle({
          tokenIn, tokenOut, fee: feeTier,
          recipient: wallet.address, amountIn,
          amountOutMinimum: 0, sqrtPriceLimitX96: 0,
        });
        const receipt = await tx.wait();
        return JSON.stringify({ success: true, txHash: receipt.hash });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ success: false, error: message });
      }
    },
  });
}

/**
 * Send ETH skill — transfer ETH via the configured RPC (Alchemy).
 *
 * Explicitly estimates gas and nonce before sending to avoid
 * common issues with Arbitrum Sepolia RPC nodes.
 */

import { ethers } from "ethers";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getProvider } from "../../../../src/core/config.js";

export function createSkill(agentPrivateKey: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "send-eth",
    description:
      "Send ETH from the agent wallet to a destination address. " +
      "Parameters: toAddress (the 0x destination) and amount (ETH as string like '0.001').",
    schema: z.object({
      toAddress: z.string().describe("Destination wallet address (0x...)"),
      amount: z.string().describe("Amount of ETH to send (e.g. '0.001')"),
    }),
    func: async ({ toAddress, amount }): Promise<string> => {
      try {
        const provider = getProvider();
        const wallet = new ethers.Wallet(agentPrivateKey, provider);
        const value = ethers.parseEther(amount);

        // Check balance first
        const balance = await provider.getBalance(wallet.address);
        if (balance < value) {
          return JSON.stringify({
            success: false,
            error: `Insufficient balance. Have ${ethers.formatEther(balance)} ETH, need ${amount} ETH.`,
          });
        }

        // Build transaction with explicit gas parameters
        const nonce = await provider.getTransactionCount(wallet.address, "latest");
        const feeData = await provider.getFeeData();

        const txRequest: ethers.TransactionRequest = {
          to: toAddress,
          value,
          nonce,
          type: 2, // EIP-1559
          chainId: (await provider.getNetwork()).chainId,
        };

        // Set gas price fields
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          txRequest.maxFeePerGas = feeData.maxFeePerGas;
          txRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        } else if (feeData.gasPrice) {
          txRequest.type = 0;
          txRequest.gasPrice = feeData.gasPrice;
        }

        // Estimate gas
        const gasEstimate = await provider.estimateGas(txRequest);
        txRequest.gasLimit = gasEstimate * 120n / 100n; // 20% buffer

        console.log(`[send-eth] Sending ${amount} ETH to ${toAddress}`);
        console.log(`[send-eth] From: ${wallet.address}`);
        console.log(`[send-eth] Nonce: ${nonce}, Gas limit: ${txRequest.gasLimit}`);

        const tx = await wallet.sendTransaction(txRequest);
        console.log(`[send-eth] TX hash: ${tx.hash}`);
        console.log(`[send-eth] Waiting for confirmation...`);

        const receipt = await tx.wait();

        return JSON.stringify({
          success: true,
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber,
          gasUsed: receipt?.gasUsed?.toString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Extract useful info from RPC errors
        const shortMsg = message.length > 300 ? message.slice(0, 300) + "..." : message;
        console.error(`[send-eth] Failed: ${shortMsg}`);
        return JSON.stringify({ success: false, error: shortMsg });
      }
    },
  });
}

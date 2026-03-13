/**
 * Send ETH skill — transfer ETH via the configured RPC.
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

        console.log(`[send-eth] Sending ${amount} ETH from ${wallet.address} to ${toAddress}`);

        const tx = await wallet.sendTransaction({ to: toAddress, value });

        console.log(`[send-eth] TX hash: ${tx.hash}`);
        console.log(`[send-eth] Waiting for confirmation...`);

        const receipt = await tx.wait();

        return JSON.stringify({
          success: true,
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const short = message.length > 300 ? message.slice(0, 300) + "..." : message;
        console.error(`[send-eth] Failed: ${short}`);
        return JSON.stringify({ success: false, error: short });
      }
    },
  });
}

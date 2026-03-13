/**
 * Send ETH skill — transfer ETH from the agent wallet to any address.
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

        console.log(`[send-eth] Sending ${amount} ETH to ${toAddress}...`);

        const tx = await wallet.sendTransaction({
          to: toAddress,
          value: ethers.parseEther(amount),
        });

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
        return JSON.stringify({ success: false, error: message });
      }
    },
  });
}

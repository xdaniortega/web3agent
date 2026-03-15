// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => ({
    getBalance: vi.fn(async () => BigInt("1000000000000000000")),
  })),
  createWalletClient: vi.fn(() => ({
    sendTransaction: vi.fn(async () => "0xabcdef1234567890"),
  })),
  http: vi.fn(),
  parseEther: vi.fn(() => BigInt("10000000000000000")),
  formatEther: vi.fn(() => "1.0"),
  defineChain: vi.fn((chain: unknown) => chain),
}))

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
  })),
}))

vi.mock("../../core/config.js", () => ({
  getRpcUrl: () => "http://localhost:8545",
  getChainId: () => 42161,
}))

describe("send-eth tool", () => {
  beforeEach(() => {
    vi.stubEnv("AGENT_PRIVATE_KEY", "0x0000000000000000000000000000000000000000000000000000000000000001")
    vi.stubEnv("RPC_URL", "http://localhost:8545")
  })

  it("returns a string on valid input", async () => {
    const { sendEthTool } = await import("../tools/send-eth.tool.js")
    const result = await sendEthTool.invoke({
      to: "0x742d35Cc6634C0532925a3b8D4C9C4A3b5C09d21",
      amount: "0.01",
    })
    expect(typeof result).toBe("string")
  })

  it("returns error string without throwing on missing private key", async () => {
    vi.stubEnv("AGENT_PRIVATE_KEY", "")
    const { sendEthTool } = await import("../tools/send-eth.tool.js")
    const result = await sendEthTool.invoke({
      to: "0xinvalid",
      amount: "0.01",
    })
    expect(typeof result).toBe("string")
    expect(result).toContain("Error")
  })
})

describe("transfer-eth skill", () => {
  it("has name, description, and context fields", async () => {
    const { transferEthSkill } = await import("../skills/transfer-eth.skill.js")
    expect(transferEthSkill.name).toBe("transfer-eth")
    expect(transferEthSkill.description).toBeTruthy()
    expect(transferEthSkill.context).toBeTruthy()
  })
})

describe("TransferEthAction factory", () => {
  it("returns object with both tools and skill", async () => {
    const { TransferEthAction } = await import("../index.js")
    const action = TransferEthAction()
    expect(action.name).toBe("transfer-eth")
    expect(Array.isArray(action.tools)).toBe(true)
    expect(action.tools.length).toBe(2)
    expect(action.tools.map((t) => t.name)).toContain("send_eth")
    expect(action.tools.map((t) => t.name)).toContain("get_token_balance")
    expect(action.skill).toBeDefined()
    expect(action.skill.name).toBe("transfer-eth")
  })
})

// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => ({
    getBalance: vi.fn(async () => BigInt("1500000000000000000")),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") return BigInt("100000000")
      if (functionName === "decimals") return 6
      if (functionName === "symbol") return "USDC"
      return undefined
    }),
  })),
  http: vi.fn(),
  formatEther: vi.fn(() => "1.5"),
  formatUnits: vi.fn(() => "100.0"),
  defineChain: vi.fn((chain: unknown) => chain),
}))

vi.mock("../../core/config.js", () => ({
  getRpcUrl: () => "http://localhost:8545",
  getChainId: () => 42161,
}))

describe("token-balance tool", () => {
  beforeEach(() => {
    vi.stubEnv("RPC_URL", "http://localhost:8545")
  })

  it("returns a string on valid input", async () => {
    const { tokenBalanceTool } = await import("../tools/token-balance.tool.js")
    const result = await tokenBalanceTool.invoke({
      address: "0x742d35Cc6634C0532925a3b8D4C9C4A3b5C09d21",
    })
    expect(typeof result).toBe("string")
  })

  it("returns error string without throwing on invalid address", async () => {
    const { tokenBalanceTool } = await import("../tools/token-balance.tool.js")
    const result = await tokenBalanceTool.invoke({
      address: "0xinvalid",
      tokenAddress: "0xinvalid",
    })
    expect(typeof result).toBe("string")
  })
})

describe("token-balance skill", () => {
  it("has name, description, and context fields", async () => {
    const { tokenBalanceSkill } = await import("../skills/token-balance.skill.js")
    expect(tokenBalanceSkill.name).toBe("token-balance")
    expect(tokenBalanceSkill.description).toBeTruthy()
    expect(tokenBalanceSkill.context).toBeTruthy()
  })
})

describe("TokenBalanceAction factory", () => {
  it("returns object with tools array and skill", async () => {
    const { TokenBalanceAction } = await import("../index.js")
    const action = TokenBalanceAction()
    expect(action.name).toBe("token-balance")
    expect(Array.isArray(action.tools)).toBe(true)
    expect(action.tools.length).toBeGreaterThan(0)
    expect(action.skill).toBeDefined()
    expect(action.skill.name).toBe("token-balance")
  })
})

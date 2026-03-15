/**
 * Interactive agent builder: name, action/tool/dynamic selection, fund, register, chat.
 *
 * Usage:
 *   npm run create-agent
 *   npm run create-agent -- --name my-agent
 *   npm run create-agent -- --name my-agent --skip-register
 */

import * as readline from "node:readline"
import dotenv from "dotenv"
import * as p from "@clack/prompts"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { getLLM } from "../core/llm.js"
import { getActiveNetwork, getNetworkConfig, getProvider } from "../core/config.js"
import {
  getOrCreateAgentWallet,
  getMasterWallet,
  getMasterWalletBalance,
  fundAgentWallet,
} from "../core/wallet.js"
import { registerAgent } from "../core/registry.js"
import { createFileCheckpointer } from "../core/file-checkpoint.js"
import { ACTION_REGISTRY, TOOL_REGISTRY } from "../core/action-registry.js"
import { saveAgentConfig, resolveToolsFromConfig, buildCapabilitySummary } from "../core/agent-config.js"
import type { AgentConfig } from "../core/agent-config.js"
import { getChainId, getNetworkNameByChainId } from "../core/config.js"
import type { Skill } from "../actions/types.js"

dotenv.config()

// ---------------------------------------------------------------------------
// Parse flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")
    ? args[idx + 1]
    : undefined
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

const skipRegister = hasFlag("skip-register")

// ---------------------------------------------------------------------------
// Selection state
// ---------------------------------------------------------------------------
interface SelectionState {
  actions: string[]
  actionToolNames: Set<string>
  tools: string[]
}

function selectionSummary(state: SelectionState): string {
  const lines: string[] = []

  if (state.actions.length > 0) {
    lines.push(`Actions : ${state.actions.join(", ")}`)
    lines.push(`  Tools : ${[...state.actionToolNames].join(", ")}`)
  }

  if (state.tools.length > 0) {
    lines.push(`Standalone tools : ${state.tools.join(", ")}`)
  }

  return lines.length > 0 ? lines.join("\n") : "(nothing selected)"
}

// ---------------------------------------------------------------------------
// Action selection loop
// ---------------------------------------------------------------------------
async function selectActions(state: SelectionState): Promise<void> {
  const options = ACTION_REGISTRY.map((a) => {
    const toolList = a.toolNames.join(", ")
    const selected = state.actions.includes(a.name)
    return {
      value: a.name,
      label: a.name,
      hint: `${a.description}  [tools: ${toolList}]${selected ? " (selected)" : ""}`,
    }
  })

  const result = await p.multiselect({
    message: "Select actions (skill + tools bundled)",
    options,
    initialValues: state.actions,
    required: false,
  })

  if (p.isCancel(result)) return

  state.actions = result as string[]
  state.actionToolNames.clear()
  for (const actionName of state.actions) {
    const entry = ACTION_REGISTRY.find((a) => a.name === actionName)
    if (entry) {
      for (const t of entry.toolNames) {
        state.actionToolNames.add(t)
      }
    }
  }
}

async function selectTools(state: SelectionState): Promise<void> {
  const options = TOOL_REGISTRY.map((t) => {
    const fromAction = state.actionToolNames.has(t.name)
    return {
      value: t.name,
      label: t.name,
      hint: fromAction
        ? `${t.description}  (included via action)`
        : t.description,
      disabled: fromAction,
    }
  })

  const result = await p.multiselect({
    message: "Select tools",
    options,
    initialValues: state.tools,
    required: false,
  })

  if (p.isCancel(result)) return

  state.tools = (result as string[]).filter((name) => !state.actionToolNames.has(name))
}

async function actionSelectionLoop(): Promise<SelectionState> {
  const state: SelectionState = {
    actions: [],
    actionToolNames: new Set(),
    tools: [],
  }

  while (true) {
    const choice = await p.select({
      message: "Configure your agent",
      options: [
        { value: "actions", label: "Actions", hint: "Opinionated bundles (skill + tools)" },
        { value: "tools", label: "Tools", hint: "Standalone tools, no reasoning layer" },
        { value: "continue", label: "Continue", hint: "Proceed with current selection" },
      ],
    })

    if (p.isCancel(choice)) {
      p.cancel("Cancelled.")
      process.exit(0)
    }

    switch (choice) {
      case "actions":
        await selectActions(state)
        break
      case "tools":
        await selectTools(state)
        break
      case "continue":
        return state
    }

    p.note(selectionSummary(state), "Current selection")
  }
}

// ---------------------------------------------------------------------------
// Chat (reused pattern from deploy.ts)
// ---------------------------------------------------------------------------
async function startChat(
  agentName: string,
  privateKey: string,
  masterAddress: string,
  config: AgentConfig,
): Promise<void> {
  process.env.AGENT_PRIVATE_KEY = privateKey

  const { tools, skills } = resolveToolsFromConfig(config)
  const toolNames = tools.map((t) => t.name)
  const { saver, flush } = createFileCheckpointer(agentName)

  console.log()
  console.log(`  Agent  : ${agentName}`)
  console.log(`  Tools  : ${toolNames.join(", ") || "none"}`)
  console.log(`  Skills : ${skills.map((s) => s.name).join(", ") || "none"}`)
  console.log(`  Master : ${masterAddress}`)
  console.log()
  console.log('  Type your message and press Enter. Type "exit" to quit.')
  console.log()

  const networkName = config.walletChainId
    ? getNetworkNameByChainId(config.walletChainId)
    : getNetworkConfig().name

  const skillContext = skills.map((s: Skill) => `## Skill: ${s.name}\n\n${s.context}`).join("\n\n")
  const capabilitySummary = buildCapabilitySummary(config)
  const systemMessage = [
    `You are "${config.name}", an onchain AI agent on ${networkName}.`,
    `Your wallet address is: ${config.walletAddress}`,
    config.walletChainId ? `Chain ID: ${config.walletChainId}` : "",
    `Owner: ${masterAddress}`,
    "",
    `## Your Capabilities\n\n${capabilitySummary}`,
    skillContext,
  ].filter(Boolean).join("\n")

  const llm = getLLM()
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: saver,
    prompt: systemMessage,
  })
  const threadId = agentName

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.on("close", () => { flush(); console.log("\nGoodbye!\n"); process.exit(0) })

  const prompt = (): void => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim()
      if (!trimmed) return prompt()
      if (trimmed.toLowerCase() === "exit") { rl.close(); return }

      try {
        const stream = await agent.stream(
          { messages: [{ role: "user", content: trimmed }] },
          { configurable: { thread_id: threadId }, recursionLimit: 8, streamMode: "updates" },
        )

        for await (const update of stream) {
          for (const [nodeName, output] of Object.entries(update)) {
            const messages = (output as any)?.messages ?? []

            for (const msg of messages) {
              const role = msg._getType?.() ?? "unknown"
              const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)

              if (role === "ai") {
                const calls = msg.tool_calls ?? []
                if (calls.length > 0) {
                  for (const tc of calls) {
                    console.log(`\n  [calling ${tc.name}] ${JSON.stringify(tc.args)}`)
                  }
                }
                if (content.trim()) {
                  console.log(`\nagent > ${content}`)
                }
              } else if (role === "tool") {
                console.log(`  [result] ${content.slice(0, 500)}`)
              }
            }
          }
        }

        console.log()
        flush()
      } catch (err: unknown) {
        console.error(`\n[error] ${err instanceof Error ? err.message : String(err)}\n`)
      }
      prompt()
    })
  }
  prompt()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  p.intro("Create Agent")

  // --- Network info ---
  const network = getActiveNetwork()
  const networkConfig = getNetworkConfig()
  const masterWallet = getMasterWallet()
  const masterBalance = await getMasterWalletBalance()

  p.note(
    `Network : ${networkConfig.name} (${network})\n` +
    `Master  : ${masterWallet.address}\n` +
    `Balance : ${masterBalance} ETH`,
    "Environment",
  )

  // --- Agent name ---
  const nameFromFlag = getFlag("name")
  let agentName: string

  if (nameFromFlag) {
    agentName = nameFromFlag
  } else {
    const nameResult = await p.text({
      message: "Agent name",
      placeholder: "my-agent",
      validate: (v) => (!v?.trim() ? "Name is required" : undefined),
    })
    if (p.isCancel(nameResult)) { p.cancel("Cancelled."); process.exit(0) }
    agentName = nameResult
  }

  // --- Action selection ---
  const state = await actionSelectionLoop()

  // --- Create wallet ---
  const s = p.spinner()
  s.start(`Creating agent "${agentName}"...`)
  const agentWallet = getOrCreateAgentWallet({ agentName })
  s.stop(`Agent wallet: ${agentWallet.address}`)

  // --- Fund amount ---
  const fundFromFlag = getFlag("fund")
  let fundAmount: string

  if (fundFromFlag) {
    fundAmount = fundFromFlag
  } else {
    const fundResult = await p.text({
      message: "ETH to fund agent",
      placeholder: "0.002",
      initialValue: "0.002",
    })
    if (p.isCancel(fundResult)) { p.cancel("Cancelled."); process.exit(0) }
    fundAmount = fundResult || "0.002"
  }

  // --- Fund agent ---
  s.start(`Funding agent with ${fundAmount} ETH...`)
  try {
    const txHash = await fundAgentWallet({
      agentAddress: agentWallet.address,
      amountEth: fundAmount,
    })
    const provider = getProvider()
    const receipt = await provider.waitForTransaction(txHash)
    s.stop(`Funded (block ${receipt?.blockNumber}): ${txHash}`)
  } catch (err) {
    s.stop(`Funding failed: ${err instanceof Error ? err.message : err}`)
  }

  // --- Persist ERC-8004 config ---
  const config: AgentConfig = {
    name: agentName,
    description: `Agent ${agentName}`,
    walletAddress: agentWallet.address,
    walletChainId: getChainId(),
    endpoints: [],
    trustModels: [],
    owners: [masterWallet.address],
    operators: [agentWallet.address],
    active: true,
    x402support: false,
    metadata: {
      actions: state.actions,
      tools: [...new Set([...state.actionToolNames, ...state.tools])],
    },
    createdAt: new Date().toISOString(),
    updatedAt: Math.floor(Date.now() / 1000),
  }
  saveAgentConfig(agentName, config)

  // --- Registration ---
  if (!skipRegister) {
    s.start("Registering on ERC-8004...")
    try {
      const reg = await registerAgent({
        name: config.name,
        description: config.description,
        privateKey: agentWallet.privateKey,
        walletAddress: agentWallet.address,
      })
      // Persist agentId and URI back into the config
      config.agentId = reg.agentId
      config.agentURI = `https://8004scan.com/api/agent/${agentWallet.address}`
      config.updatedAt = Math.floor(Date.now() / 1000)
      saveAgentConfig(agentName, config)
      s.stop(`Registered. Agent ID: ${reg.agentId}`)
    } catch (err) {
      s.stop(`Registration failed: ${err instanceof Error ? err.message : err}`)
    }
  } else {
    p.log.info("Skipping ERC-8004 registration (--skip-register)")
  }

  // --- Summary ---
  const provider = getProvider()
  const agentBalance = await provider.getBalance(agentWallet.address)
  const { ethers } = await import("ethers")

  const allToolNames = [
    ...[...state.actionToolNames],
    ...state.tools,
  ]

  p.note(
    `Name     : ${agentName}\n` +
    (config.agentId ? `Agent ID : ${config.agentId}\n` : "") +
    `Wallet   : ${agentWallet.address}\n` +
    `Chain    : ${config.walletChainId}\n` +
    `Balance  : ${ethers.formatEther(agentBalance)} ETH\n` +
    `Actions  : ${state.actions.join(", ") || "none"}\n` +
    `Tools    : ${allToolNames.join(", ") || "none"}\n` +
    `Owner    : ${masterWallet.address}`,
    "Agent Created (ERC-8004)",
  )

  // --- Open chat ---
  const chatResult = await p.confirm({
    message: "Open interactive chat?",
    initialValue: true,
  })

  if (p.isCancel(chatResult) || !chatResult) {
    p.outro("Done. Run `npm run chat -- --agent " + agentName + "` to chat later.")
    return
  }

  p.outro("Starting chat...")
  await startChat(agentName, agentWallet.privateKey, masterWallet.address, config)
}

main().catch((err) => {
  p.cancel(`Fatal: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
})

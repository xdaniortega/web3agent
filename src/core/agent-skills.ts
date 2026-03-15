/**
 * Per-agent skill discovery and loading.
 *
 * Each agent has its own skills under `agents/<name>/skills/<skill-name>/`.
 * A skill directory contains:
 *   - SKILL.md, YAML frontmatter (name, description) + usage instructions
 *   - index.ts, exports a createSkill factory
 *
 * @module agent-skills
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { AGENTS_DIR } from "./wallet.js";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { AgentSkillConfig } from "./types.js";

/** Skill factory type: accepts the agent's private key, returns a tool. */
export type SkillFactory = (agentPrivateKey: string) => DynamicStructuredTool;

/**
 * Parse simple YAML frontmatter from a SKILL.md file.
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const frontmatter: Record<string, string> = {};
  let body = content;

  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (match) {
    const yaml = match[1];
    body = match[2].trim();

    for (const line of yaml.split("\n")) {
      const kv = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
      if (kv) {
        frontmatter[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
      }
    }
  }

  return { frontmatter, body };
}

/**
 * Discovers skills configured for an agent by scanning
 * `agents/<agentName>/skills/` for directories with SKILL.md files.
 */
export function discoverAgentSkills(agentName: string): AgentSkillConfig[] {
  const skillsDir = path.join(AGENTS_DIR, agentName, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const configs: AgentSkillConfig[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    const raw = fs.readFileSync(skillMdPath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(raw);

    configs.push({
      name: frontmatter.name || entry.name,
      description: frontmatter.description,
      instructions: body || undefined,
    });
  }

  return configs;
}

/**
 * Lists skill names available to an agent.
 */
export function listAgentSkills(agentName: string): string[] {
  return discoverAgentSkills(agentName).map((c) => c.name);
}

/**
 * Dynamically imports and instantiates skill tools from an agent's directory.
 */
export async function resolveAgentSkills(
  agentName: string,
  agentPrivateKey: string
): Promise<DynamicStructuredTool[]> {
  const skillsDir = path.join(AGENTS_DIR, agentName, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const tools: DynamicStructuredTool[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const indexPath = path.join(skillsDir, entry.name, "index.ts");
    if (!fs.existsSync(indexPath)) {
      console.warn(`[agent-skills] Skill "${entry.name}" has no index.ts, skipping.`);
      continue;
    }

    try {
      const mod = await import(pathToFileURL(indexPath).href);
      const factory: SkillFactory = mod.createSkill || mod.default;
      if (typeof factory !== "function") {
        console.warn(`[agent-skills] Skill "${entry.name}" does not export createSkill, skipping.`);
        continue;
      }
      tools.push(factory(agentPrivateKey));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agent-skills] Failed to load skill "${entry.name}": ${msg}`);
    }
  }

  return tools;
}

/**
 * Builds a system prompt section from skill instructions.
 */
export function buildSkillSystemPrompt(configs: AgentSkillConfig[]): string {
  const sections = configs
    .filter((c) => c.instructions)
    .map((c) => `## Skill: ${c.name}\n\n${c.instructions}`);
  return sections.join("\n\n");
}

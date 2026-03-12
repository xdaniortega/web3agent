/**
 * Skill registry.
 *
 * Each skill is a factory function that takes an agent's private key and
 * returns a LangChain DynamicStructuredTool. To add a new skill:
 *
 * 1. Create a new module in src/skills/ (e.g., src/skills/my-skill.ts)
 * 2. Export a factory function: (privateKey: string) => DynamicStructuredTool
 * 3. Register it in the SKILL_REGISTRY below
 *
 * No changes to the orchestrator are needed — it resolves skills by name
 * from this registry.
 *
 * @module skills
 */

import type { DynamicStructuredTool } from "@langchain/core/tools";
import { createUniswapSwapSkill } from "./uniswap-swap.js";

/** Skill factory type: accepts the agent's private key, returns a tool. */
export type SkillFactory = (agentPrivateKey: string) => DynamicStructuredTool;

/**
 * Registry mapping skill names to their factory functions.
 * Add new skills here to make them available to the orchestrator.
 */
const SKILL_REGISTRY: Record<string, SkillFactory> = {
  "uniswap-swap": createUniswapSwapSkill,
  // To add a new skill:
  // "my-skill": createMySkill,
};

/**
 * Returns a list of all registered skill names.
 *
 * @returns An array of available skill names.
 */
export function listSkills(): string[] {
  return Object.keys(SKILL_REGISTRY);
}

/**
 * Resolves skill names to tool instances, injecting the agent's private key.
 *
 * @param skillNames - Names of skills to resolve (max 3).
 * @param agentPrivateKey - The agent's private key for transaction signing.
 * @returns An array of LangChain DynamicStructuredTool instances.
 * @throws If a skill name is not found in the registry.
 * @throws If more than 3 skills are requested.
 */
export function resolveSkills(
  skillNames: string[],
  agentPrivateKey: string
): DynamicStructuredTool[] {
  if (skillNames.length > 3) {
    throw new Error(
      `A maximum of 3 skills can be attached to a single agent. Received ${skillNames.length}.`
    );
  }

  return skillNames.map((name) => {
    const factory = SKILL_REGISTRY[name];
    if (!factory) {
      throw new Error(
        `Unknown skill "${name}". Available skills: ${listSkills().join(", ")}`
      );
    }
    return factory(agentPrivateKey);
  });
}

export { createUniswapSwapSkill } from "./uniswap-swap.js";

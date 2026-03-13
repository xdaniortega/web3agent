/**
 * Scaffold skill templates into an agent's directory.
 * @module scaffold
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS_DIR } from "../core/wallet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "templates");

export function listSkillTemplates(): string[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function scaffoldAgentSkill(agentName: string, skillName: string): void {
  const templateDir = path.join(TEMPLATES_DIR, skillName);
  if (!fs.existsSync(templateDir)) {
    const available = listSkillTemplates();
    throw new Error(
      `Unknown skill template "${skillName}". Available: ${available.join(", ") || "none"}`
    );
  }

  const targetDir = path.join(AGENTS_DIR, agentName, "skills", skillName);
  if (fs.existsSync(targetDir)) {
    console.log(`[skills] "${skillName}" already installed for agent "${agentName}".`);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  copyDirSync(templateDir, targetDir);
  console.log(`[skills] Installed "${skillName}" into agents/${agentName}/skills/${skillName}/`);
}

function copyDirSync(src: string, dest: string): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

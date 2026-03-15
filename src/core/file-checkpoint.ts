/**
 * File-based checkpoint saver for persistent agent memory.
 *
 * Wraps MemorySaver and syncs to/from a JSON file in the agent's directory.
 * Memory survives process restarts.
 *
 * @module file-checkpoint
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { MemorySaver } from "@langchain/langgraph";
import { AGENTS_DIR } from "./wallet.js";

/**
 * Creates a MemorySaver that loads from and saves to disk.
 *
 * On creation, loads existing state from `agents/<agentName>/memory.json`.
 * Call `flush()` after each invoke to persist changes.
 */
export function createFileCheckpointer(agentName: string) {
  const memoryPath = path.join(AGENTS_DIR, agentName, "memory.json");
  const saver = new MemorySaver();

  // Load existing state
  if (fs.existsSync(memoryPath)) {
    try {
      const raw = fs.readFileSync(memoryPath, "utf-8");
      const data = JSON.parse(raw);
      if (data.storage) {
        // Restore Uint8Array values from base64
        for (const threadId of Object.keys(data.storage)) {
          saver.storage[threadId] = {};
          for (const ns of Object.keys(data.storage[threadId])) {
            saver.storage[threadId][ns] = {};
            for (const key of Object.keys(data.storage[threadId][ns])) {
              const entry = data.storage[threadId][ns][key];
              saver.storage[threadId][ns][key] = [
                Uint8Array.from(Buffer.from(entry[0], "base64")),
                Uint8Array.from(Buffer.from(entry[1], "base64")),
                entry[2],
              ];
            }
          }
        }
      }
      if (data.writes) {
        for (const threadId of Object.keys(data.writes)) {
          saver.writes[threadId] = {};
          for (const key of Object.keys(data.writes[threadId])) {
            const entry = data.writes[threadId][key];
            saver.writes[threadId][key] = [
              entry[0],
              entry[1],
              Uint8Array.from(Buffer.from(entry[2], "base64")),
            ];
          }
        }
      }
      console.log(`[memory] Loaded conversation from agents/${agentName}/memory.json`);
    } catch {
      // Corrupted file, start fresh
      console.warn(`[memory] Could not load memory file, starting fresh.`);
    }
  }

  function flush() {
    const data: Record<string, unknown> = { storage: {}, writes: {} };

    // Serialize Uint8Array to base64
    const storage: Record<string, Record<string, Record<string, [string, string, string | undefined]>>> = {};
    for (const threadId of Object.keys(saver.storage)) {
      storage[threadId] = {};
      for (const ns of Object.keys(saver.storage[threadId])) {
        storage[threadId][ns] = {};
        for (const key of Object.keys(saver.storage[threadId][ns])) {
          const entry = saver.storage[threadId][ns][key];
          storage[threadId][ns][key] = [
            Buffer.from(entry[0]).toString("base64"),
            Buffer.from(entry[1]).toString("base64"),
            entry[2],
          ];
        }
      }
    }
    data.storage = storage;

    const writes: Record<string, Record<string, [string, string, string]>> = {};
    for (const threadId of Object.keys(saver.writes)) {
      writes[threadId] = {};
      for (const key of Object.keys(saver.writes[threadId])) {
        const entry = saver.writes[threadId][key];
        writes[threadId][key] = [
          entry[0],
          entry[1],
          Buffer.from(entry[2]).toString("base64"),
        ];
      }
    }
    data.writes = writes;

    fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
    fs.writeFileSync(memoryPath, JSON.stringify(data), "utf-8");
  }

  return { saver, flush };
}

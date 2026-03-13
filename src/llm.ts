/**
 * LLM provider factory.
 *
 * Returns a LangChain chat model based on the LLM_PROVIDER env var.
 * Supported providers: openrouter (default), anthropic, openai.
 *
 * @module llm
 */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/** Supported LLM provider identifiers. */
export type LLMProvider = "openrouter" | "anthropic" | "openai";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openrouter: "anthropic/claude-sonnet-4",
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
};

/**
 * Returns the active LLM provider from the LLM_PROVIDER env var.
 * Defaults to "openrouter".
 */
export function getProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER || "openrouter";
  const valid: LLMProvider[] = ["openrouter", "anthropic", "openai"];
  if (!valid.includes(raw as LLMProvider)) {
    throw new Error(
      `Unsupported LLM_PROVIDER "${raw}". Supported: ${valid.join(", ")}`
    );
  }
  return raw as LLMProvider;
}

/**
 * Creates and returns a LangChain chat model for the active provider.
 *
 * @param options.streaming - Enable streaming output (default false).
 * @returns A LangChain BaseChatModel instance.
 * @throws If the required API key env var is not set.
 */
export async function getLLM(options: { streaming?: boolean } = {}): Promise<BaseChatModel> {
  const provider = getProvider();
  const { streaming = false } = options;

  switch (provider) {
    case "openrouter": {
      const apiKey = requireEnv("OPENROUTER_API_KEY", "https://openrouter.ai/keys");
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        modelName: process.env.LLM_MODEL || DEFAULT_MODELS.openrouter,
        openAIApiKey: apiKey,
        streaming,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
      });
    }

    case "anthropic": {
      const apiKey = requireEnv("ANTHROPIC_API_KEY", "https://console.anthropic.com");
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({
        model: process.env.LLM_MODEL || DEFAULT_MODELS.anthropic,
        anthropicApiKey: apiKey,
        streaming,
      });
    }

    case "openai": {
      const apiKey = requireEnv("OPENAI_API_KEY", "https://platform.openai.com/api-keys");
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        modelName: process.env.LLM_MODEL || DEFAULT_MODELS.openai,
        openAIApiKey: apiKey,
        streaming,
      });
    }
  }
}

function requireEnv(name: string, url: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Get a key at ${url}`);
  }
  return value;
}

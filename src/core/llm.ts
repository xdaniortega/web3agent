/**
 * Multi-provider LLM abstraction.
 *
 * Supports three providers via LLM_PROVIDER env var:
 *   - openrouter (default) — any model via the @openrouter/sdk
 *   - anthropic            — Claude models via @langchain/anthropic
 *   - openai               — OpenAI models via @langchain/openai
 *
 * @module llm
 */

import { OpenRouter } from "@openrouter/sdk";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
  type BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { Runnable } from "@langchain/core/runnables";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessageChunk } from "@langchain/core/messages";
import { zodToJsonSchema } from "zod-to-json-schema";

/** OpenRouter message (simplified). */
type ORMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string; toolCalls?: ORToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

interface ORToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ORToolDef {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}

export type LLMProvider = "openrouter" | "anthropic" | "openai";
type Provider = LLMProvider;

const DEFAULT_MODELS: Record<Provider, string> = {
  openrouter: "openrouter/auto",
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
};

// ---------------------------------------------------------------------------
// ChatOpenRouter — LangChain BaseChatModel backed by @openrouter/sdk
// ---------------------------------------------------------------------------

interface ChatOpenRouterInput extends BaseChatModelParams {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

interface ChatOpenRouterCallOptions extends BaseChatModelCallOptions {
  tools?: ORToolDef[];
}

/** Convert a LangChain message to an OpenRouter message. */
function toORMessage(msg: BaseMessage): ORMessage {
  const type = msg._getType();
  switch (type) {
    case "system":
      return { role: "system", content: msgText(msg) } as ORMessage;
    case "human":
      return { role: "user", content: msgText(msg) } as ORMessage;
    case "ai": {
      const aiMsg = msg as AIMessage;
      const base: Record<string, unknown> = {
        role: "assistant",
        content: msgText(msg) || undefined,
      };
      if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
        base.toolCalls = aiMsg.tool_calls.map((tc) => ({
          id: tc.id ?? "",
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }));
      }
      return base as ORMessage;
    }
    case "tool": {
      const toolMsg = msg as ToolMessage;
      return {
        role: "tool",
        content: msgText(msg),
        toolCallId: toolMsg.tool_call_id,
      } as ORMessage;
    }
    default:
      return { role: "user", content: msgText(msg) } as ORMessage;
  }
}

function msgText(msg: BaseMessage): string {
  return typeof msg.content === "string"
    ? msg.content
    : JSON.stringify(msg.content);
}

class ChatOpenRouter extends BaseChatModel<ChatOpenRouterCallOptions> {
  private client: OpenRouter;
  private model: string;
  private maxTokens: number;
  private boundTools: ORToolDef[] = [];

  constructor(fields: ChatOpenRouterInput) {
    super(fields);
    this.client = new OpenRouter({ apiKey: fields.apiKey });
    this.model = fields.model;
    this.maxTokens = fields.maxTokens ?? 1024;
  }

  _llmType(): string {
    return "openrouter";
  }

  bindTools(
    tools: BindToolsInput[],
    _kwargs?: Partial<ChatOpenRouterCallOptions>,
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenRouterCallOptions> {
    const orTools: ORToolDef[] = tools.map((t) => {
      // Handle StructuredTool / DynamicStructuredTool
      if ("name" in t && "schema" in t) {
        const st = t as { name: string; description?: string; schema: { _def?: unknown } };
        return {
          type: "function" as const,
          function: {
            name: st.name,
            description: st.description ?? "",
            parameters: jsonSchemaFromZod(st.schema),
          },
        };
      }
      // Handle raw tool definition objects
      if ("type" in t && (t as Record<string, unknown>).type === "function") {
        return t as ORToolDef;
      }
      // Handle { name, description, parameters } format
      const raw = t as Record<string, unknown>;
      return {
        type: "function" as const,
        function: {
          name: (raw.name as string) ?? "unknown",
          description: (raw.description as string) ?? "",
          parameters: (raw.parameters as Record<string, unknown>) ?? {},
        },
      };
    });

    const clone = new ChatOpenRouter({
      apiKey: "",
      model: this.model,
      maxTokens: this.maxTokens,
    });
    clone.client = this.client;
    clone.boundTools = orTools;
    return clone;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const orMessages = messages.map(toORMessage);
    const tools =
      options.tools && options.tools.length > 0
        ? options.tools
        : this.boundTools.length > 0
          ? this.boundTools
          : undefined;

    const response = await this.client.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: orMessages,
        maxTokens: this.maxTokens,
        stream: false,
        ...(tools ? { tools } : {}),
      },
    });

    const choice = response.choices?.[0];
    if (process.env.DEBUG_LLM) {
      console.log("[debug:llm] _generate called");
      console.log("[debug:llm] tools sent:", JSON.stringify(tools?.map((t: ORToolDef) => ({
        name: t.function.name,
        params: Object.keys((t.function.parameters as any)?.properties ?? {}),
      }))));
      console.log("[debug:llm] response:", JSON.stringify(choice?.message, null, 2));
    }
    if (!choice) {
      return {
        generations: [
          {
            text: "",
            message: new AIMessage({ content: "" }),
          },
        ],
      };
    }

    const content =
      typeof choice.message.content === "string"
        ? choice.message.content
        : choice.message.content != null
          ? JSON.stringify(choice.message.content)
          : "";

    const toolCalls = choice.message.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments),
      type: "tool_call" as const,
    }));

    const aiMessage = new AIMessage({
      content,
      tool_calls: toolCalls,
    });

    return {
      generations: [
        {
          text: content,
          message: aiMessage,
        },
      ],
    };
  }

}

/** Extract JSON Schema from a Zod schema (best-effort). */
function jsonSchemaFromZod(schema: unknown): Record<string, unknown> {
  if (schema && typeof schema === "object") {
    // If it has a jsonSchema method (zod-to-json-schema integration)
    if ("jsonSchema" in schema && typeof (schema as Record<string, unknown>).jsonSchema === "function") {
      return (schema as { jsonSchema: () => Record<string, unknown> }).jsonSchema();
    }
    try {
      const result = zodToJsonSchema(schema as any) as Record<string, unknown>;
      // Remove $schema — some providers reject it
      delete result.$schema;
      return result;
    } catch {
      return { type: "object", properties: {} };
    }
  }
  return { type: "object", properties: {} };
}

// ---------------------------------------------------------------------------
// getLLM — public factory
// ---------------------------------------------------------------------------

/**
 * Creates a LangChain chat model for the configured provider.
 *
 * @param options.streaming - Enable streaming output (default false).
 * @returns A BaseChatModel instance for the selected provider.
 * @throws If the required API key for the provider is not set.
 */
export function getLLM(options: { streaming?: boolean } = {}): BaseChatModel {
  const provider = (process.env.LLM_PROVIDER || "openrouter") as Provider;
  const { streaming = false } = options;
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];

  switch (provider) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys"
        );
      }
      return new ChatOpenRouter({ apiKey, model, maxTokens: 4096 });
    }

    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Get a key at https://console.anthropic.com/"
        );
      }
      return new ChatAnthropic({
        modelName: model,
        anthropicApiKey: apiKey,
        streaming,
      });
    }

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is not set. Get a key at https://platform.openai.com/api-keys"
        );
      }
      return new ChatOpenAI({
        modelName: model,
        openAIApiKey: apiKey,
        streaming,
      });
    }

    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Use one of: openrouter, anthropic, openai`
      );
  }
}

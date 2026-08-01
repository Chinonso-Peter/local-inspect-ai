import { readFile } from "@tauri-apps/plugin-fs";
import { SYSTEM_AUDIT_PROMPT } from "./prompt.ts";
import type { ChatMessage } from "../types/chat";

export interface AuditRequestOptions {
  imagePath: string;
  userNote?: string;
  onChunk: (chunk: string) => void;
  onError: (err: string) => void;
}

export interface ChatStreamOptions {
  messages: ChatMessage[];
  onChunk: (chunk: string) => void;
  onError: (err: string) => void;
  systemPrompt?: string;
  timeoutMs?: number;
}

const OLLAMA_CHAT_URL = "http://localhost:11434/api/chat";
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL?.trim() || "gemma4:e2b";
const DEFAULT_MODEL_TIMEOUT_MS = 300_000;
const RECENT_TURNS_TO_KEEP = 6;
const MESSAGES_PER_TURN = 2;

// Shared entry point for any workflow that needs a local Gemma response.
export async function runLocalAudit({
  imagePath,
  userNote = "Perform a complete physical security and safety audit.",
  onChunk,
  onError,
}: AuditRequestOptions) {
  try {
    const rawBase64 = await readImagePathAsBase64(imagePath);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `Additional User Request/Notes: ${userNote}`,
      images: [rawBase64],
      timestamp: Date.now(),
    };

    await sendChatMessage({
      messages: [userMessage],
      onChunk,
      onError,
    });
  } catch (err: any) {
    console.error("Local audit error details:", err);
    onError(typeof err === "string" ? err : err?.message || JSON.stringify(err));
  }
}

export async function readImagePathAsBase64(imagePath: string): Promise<string> {
  const normalizedPath = normalizeFilePath(imagePath);

  let imageBytes: Uint8Array;
  try {
    imageBytes = await readFile(normalizedPath);
  } catch {
    throw new Error(
      `Couldn't read the selected image at "${normalizedPath}". Check that the file still exists and the app has permission to access it.`,
    );
  }

  return bytesToBase64(imageBytes);
}

export async function sendChatMessage({
  messages,
  onChunk,
  onError,
  systemPrompt = SYSTEM_AUDIT_PROMPT,
  timeoutMs,
}: ChatStreamOptions): Promise<{ content: string; doneReason?: string }> {
  try {
    // Every feature routes through the same streaming client so behavior stays consistent.
    return await streamChatCompletion(
      DEFAULT_MODEL,
      buildRequestMessages(messages, systemPrompt),
      onChunk,
      resolveRequestTimeoutMs(timeoutMs),
    );
  } catch (err: any) {
    const detail = typeof err === "string" ? err : err?.message || JSON.stringify(err);
    onError(detail);
    throw err;
  }
}

export function resolveRequestTimeoutMs(timeoutMs?: number, configuredEnvironmentTimeoutMs?: number): number {
  const explicitTimeout = normalizeTimeoutMs(timeoutMs);
  if (explicitTimeout !== undefined) {
    return explicitTimeout;
  }

  const configuredTimeout = normalizeTimeoutMs(configuredEnvironmentTimeoutMs ?? import.meta.env.VITE_OLLAMA_TIMEOUT_MS);
  if (configuredTimeout !== undefined) {
    return configuredTimeout;
  }

  return DEFAULT_MODEL_TIMEOUT_MS;
}

function normalizeTimeoutMs(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsedValue = Number(trimmed);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return undefined;
}

function buildRequestMessages(
  messages: ChatMessage[],
  systemPrompt: string,
): Array<{ role: "system" | "user" | "assistant"; content: string; images?: string[] }> {
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...trimConversationForContext(messages).map((message) => ({
      role: message.role,
      content: message.content,
      images: message.images?.length ? message.images : undefined,
    })),
  ];
}

function trimConversationForContext(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= (RECENT_TURNS_TO_KEEP * MESSAGES_PER_TURN) + 2) {
    return messages;
  }

  // Keep the first scan and the most recent turns so long sessions stay coherent.
  const initialScan = messages.slice(0, 2);
  const recentMessages = messages.slice(-RECENT_TURNS_TO_KEEP * MESSAGES_PER_TURN);
  return [...initialScan, ...recentMessages];
}

function normalizeFilePath(imagePath: string): string {
  const stripped = imagePath.replace(/^file:\/\//, "");
  try {
    return decodeURI(stripped);
  } catch {
    return stripped;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function streamChatCompletion(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string; images?: string[] }>,
  onChunk: (chunk: string) => void,
  timeoutMs: number,
): Promise<{ content: string; doneReason?: string }> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    // Ollama streams one JSON object per line, so the parser below reads incrementally.
    response = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        options: {
          num_gpu: 0,
          num_ctx: 8192,
          num_predict: 2048,
          temperature: 0.2,
        },
        messages,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`The local model request timed out after ${timeoutMs}ms.`);
    }

    throw new Error(
      "Unable to connect to Ollama at http://localhost:11434. Make sure Ollama is running and the model is available.",
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Ollama API error (${response.status}): ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  if (!response.body) {
    throw new Error("Failed to initialize stream from local Gemma model.");
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let bufferedText = "";
    let content = "";
    let doneReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      bufferedText += decoder.decode(value, { stream: !done });

      let newlineIndex = bufferedText.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = bufferedText.slice(0, newlineIndex).trim();
        bufferedText = bufferedText.slice(newlineIndex + 1);

        if (line) {
          const parsed = tryParseJson(line);
          if (parsed) {
            const chunk = parsed.message?.content ?? parsed.response ?? "";
            if (chunk) {
              content += chunk;
              onChunk(chunk);
            }
            if (parsed.done && typeof parsed.done_reason === "string") {
              doneReason = parsed.done_reason;
            } else if (parsed.done && typeof parsed.finish_reason === "string") {
              doneReason = parsed.finish_reason;
            }
          }
        }

        newlineIndex = bufferedText.indexOf("\n");
      }

      if (done) {
        break;
      }
    }

    const trailingLine = bufferedText.trim();
    if (trailingLine) {
      const parsed = tryParseJson(trailingLine);
      if (parsed) {
        const chunk = parsed.message?.content ?? parsed.response ?? "";
        if (chunk) {
          content += chunk;
          onChunk(chunk);
        }
        if (parsed.done && typeof parsed.done_reason === "string") {
          doneReason = parsed.done_reason;
        } else if (parsed.done && typeof parsed.finish_reason === "string") {
          doneReason = parsed.finish_reason;
        }
      }
    }

    return { content, doneReason };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function tryParseJson(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

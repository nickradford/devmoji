import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

/**
 * Codex stores sessions as JSONL files at:
 *   ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 *
 * Each line is JSON with structure:
 *   { "timestamp": "...", "type": "response_item", "payload": { "type": "message", "role": "user", "content": [...] } }
 *
 * User messages have payload.role === "user" and content is an array of
 *   { "type": "input_text", "text": "..." }
 *
 * We skip messages that are just environment context injections.
 */

const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");

export function codexAdapter(): Adapter {
  return {
    name: "codex",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      yield* walkCodexSessions(CODEX_SESSIONS_DIR, options);
    },
  };
}

async function* walkCodexSessions(
  dir: string,
  options?: AdapterOptions,
): AsyncGenerator<Message> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return; // Codex not installed or no sessions
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      yield* walkCodexSessions(fullPath, options);
    } else if (entry.endsWith(".jsonl")) {
      const session = entry.replace(".jsonl", "");
      yield* parseCodexJsonl(fullPath, { session, since: options?.since });
    }
  }
}

async function* parseCodexJsonl(
  filePath: string,
  context: { session: string; since?: Date },
): AsyncGenerator<Message> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as CodexEntry;

      // Only care about response_item entries with user messages
      if (entry.type !== "response_item") continue;

      const payload = entry.payload;
      if (!payload || payload.role !== "user") continue;

      const text = extractText(payload.content);
      if (!text) continue;

      // Skip environment context injections (they start with <environment_context>)
      if (text.startsWith("<environment_context>")) continue;
      // Skip permission/sandbox instructions
      if (text.startsWith("<permissions instructions>")) continue;

      if (context.since && entry.timestamp) {
        const ts = new Date(entry.timestamp);
        if (ts < context.since) continue;
      }

      yield {
        text,
        timestamp: entry.timestamp,
        session: context.session,
      };
    } catch {
      // Skip malformed lines
    }
  }
}

function extractText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;

  const parts = content
    .filter(
      (p): p is { type: string; text: string } =>
        typeof p === "object" &&
        p !== null &&
        p.type === "input_text" &&
        typeof p.text === "string",
    )
    .map((p) => p.text);

  return parts.length > 0 ? parts.join(" ") : null;
}

interface CodexEntry {
  timestamp?: string;
  type: string;
  payload?: {
    type?: string;
    role?: string;
    content?: unknown;
  };
}

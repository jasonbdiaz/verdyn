// MiniMax text client — OpenAI-compatible chat completions, plain fetch (no SDK).
// Mirrors the proven invocation used across the user's other projects: the
// `/v1/chat/completions` endpoint with Bearer auth and an M-series reasoning
// model. M-series emit a <think>…</think> block we strip before parsing.
//
// Configured via env (set in Vercel): MINIMAX_API_KEY (the sk-cp coding-plan
// key shared across projects) and optional MINIMAX_MODEL / MINIMAX_BASE_URL.
// Returns null on ANY failure so callers fall back to the deterministic engine.

const BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
const MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3";

export const minimaxConfigured = (): boolean => Boolean(process.env.MINIMAX_API_KEY);

function stripThinking(text: string): string {
  const s = String(text);
  const close = s.lastIndexOf("</think>");
  return close !== -1 ? s.slice(close + "</think>".length).trim() : s.trim();
}

/** Pull the first balanced JSON object out of a model response. */
export function extractJson<T = unknown>(text: string): T | null {
  const cleaned = stripThinking(text);
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export const MINIMAX_MODEL = MODEL;

/** Single completion. Returns the raw text, or null on any failure. */
export async function minimaxComplete(
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: opts.maxTokens ?? 2500,
        temperature: opts.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.warn(`[verdyn] MiniMax HTTP ${res.status}`);
      return null;
    }
    const j = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      base_resp?: { status_code?: number; status_msg?: string };
    };
    if (j.base_resp && j.base_resp.status_code) {
      console.warn(`[verdyn] MiniMax error ${j.base_resp.status_code}: ${j.base_resp.status_msg}`);
      return null;
    }
    const content = j.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (e) {
    console.warn("[verdyn] MiniMax call failed:", (e as Error).message);
    return null;
  }
}

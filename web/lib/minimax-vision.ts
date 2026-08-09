// MiniMax vision client — identifies a sprinkler head from a photo. Same engine,
// key and OpenAI-compatible endpoint we already use for text (see minimax.ts),
// just a vision-capable model and a multimodal message. The model name is env-
// overridable (MINIMAX_VISION_MODEL) so it can be retargeted without a code change.
//
// Returns null on ANY failure — the UI then falls back to the manual visual
// picker, exactly like the deterministic-engine fallback elsewhere. The scanner
// is a convenience that improves the FIRST guess at a zone's precip rate; runtime
// self-calibration (F2) and the optional catch-cup field refine it later.

import { HEAD_TYPES, type HeadTypeId } from "@verdyn/core";
import { extractJson } from "./minimax";
import { headReferencePrompt, HEAD_ID_LIST } from "./head-reference";

const BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
// MiniMax-M3 is multimodal (verified) — same model we use for text. It's a
// reasoning model that emits a <think> block, so give max_tokens headroom and
// let extractJson() strip the thinking before parsing.
const VISION_MODEL = process.env.MINIMAX_VISION_MODEL || "MiniMax-M3";

export interface HeadGuess {
  headTypeId: HeadTypeId;
  /** 0..1 — how sure the model is. Low confidence ⇒ UI asks the user to confirm. */
  confidence: number;
  /** Friendly name to show ("Fixed spray"). */
  label: string;
  /** Up to 3 short visual reasons ("fan pattern", "no moving parts"). */
  cues: string[];
}

const HEAD_IDS = new Set<string>(HEAD_TYPES.map((h) => h.id));

export const visionConfigured = (): boolean => Boolean(process.env.MINIMAX_API_KEY);

const clamp01 = (n: unknown): number => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v > 1 ? v / 100 : v)); // tolerate 0-100 scale
};

/**
 * @param imageUrl a data: URL (base64) or http(s) URL of the head photo.
 */
export async function identifyHeadFromImage(imageUrl: string): Promise<HeadGuess | null> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) return null;

  const system =
    `You are an irrigation technician identifying ONE lawn/garden sprinkler head from a single photo. ` +
    `Classify it into exactly one of these categories by its visible mechanism — not the brand:\n` +
    headReferencePrompt() +
    `\n\nIf the photo is unclear, pick the most likely category but lower your confidence. ` +
    `Respond with ONLY a JSON object, no prose:\n` +
    `{"headTypeId": <one of ${JSON.stringify(HEAD_ID_LIST)}>, "confidence": <0..1>, ` +
    `"label": <short human name>, "cues": [<up to 3 short visual reasons>]}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this sprinkler head. Return JSON only." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1200, // headroom for M3's <think> block + the JSON
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.warn(`[verdyn] vision HTTP ${res.status}`);
      return null;
    }
    const j = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      base_resp?: { status_code?: number; status_msg?: string };
    };
    if (j.base_resp?.status_code) {
      console.warn(`[verdyn] vision base_resp ${j.base_resp.status_code}: ${j.base_resp.status_msg}`);
      return null;
    }
    const text = j.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = extractJson<{ headTypeId?: string; confidence?: unknown; label?: string; cues?: unknown }>(text);
    if (!parsed || typeof parsed.headTypeId !== "string" || !HEAD_IDS.has(parsed.headTypeId)) return null;

    const cues = Array.isArray(parsed.cues)
      ? parsed.cues.filter((c): c is string => typeof c === "string").slice(0, 3)
      : [];

    return {
      headTypeId: parsed.headTypeId as HeadTypeId,
      confidence: clamp01(parsed.confidence),
      label: typeof parsed.label === "string" && parsed.label ? parsed.label.slice(0, 40) : parsed.headTypeId,
      cues,
    };
  } catch (e) {
    console.warn("[verdyn] vision call failed", e);
    return null;
  }
}

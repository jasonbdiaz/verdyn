import { NextResponse } from "next/server";
import { identifyHeadFromImage, visionConfigured } from "@/lib/minimax-vision";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// AI sprinkler-head scanner (onboarding "Not sure? Scan here"). Anonymous —
// onboarding has no account yet — but rate-limited per IP because each call hits
// a paid vision model. The client downscales the photo before upload; we still
// cap the body defensively. Any failure returns guess:null so the UI falls back
// to the manual visual picker.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ~4MB; a downscaled JPEG is far smaller
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|heic|heif);base64,/i;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`head-scan:${ip}`, 20, 10 * 60 * 1000); // 20 / 10 min
  if (!rl.ok) {
    return NextResponse.json(
      { guess: null, reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Scanner not provisioned (no MiniMax key) — tell the UI to just show the picker.
  if (!visionConfigured()) {
    return NextResponse.json({ guess: null, reason: "scanner_unavailable" });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES + 1024) {
    return NextResponse.json({ guess: null, reason: "too_large" }, { status: 413 });
  }

  let body: { image?: unknown };
  try {
    const text = await req.text();
    if (text.length > MAX_IMAGE_BYTES + 1024) {
      return NextResponse.json({ guess: null, reason: "too_large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ guess: null, reason: "bad_request" }, { status: 400 });
  }

  const image = body?.image;
  if (typeof image !== "string" || !DATA_URL_RE.test(image)) {
    return NextResponse.json({ guess: null, reason: "bad_image" }, { status: 400 });
  }

  const guess = await identifyHeadFromImage(image);
  return NextResponse.json({ guess, reason: guess ? null : "no_match" });
}

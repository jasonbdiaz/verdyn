"use client";

// Primary UX for choosing a zone's sprinkler head: a gallery of REAL reference
// photos of the five common head/body types the user can match by eye (zero AI
// cost, instant) with a "Not sure? Scan here" fallback that photographs the head
// and asks the vision model. The head sets the zone's precip rate — the single
// input a homeowner is most likely to get wrong and the one that most distorts
// run times — so making it pickable by picture matters.
//
// `compact` renders the denser variant used inline in the basic onboarding flow.

import { useRef, useState } from "react";
import Image from "next/image";
import { type HeadTypeId } from "@verdyn/core";
import { HEAD_VISUAL, headVisualById } from "@/lib/head-reference";

interface HeadGuessResult {
  headTypeId: HeadTypeId;
  confidence: number;
  label: string;
  cues: string[];
}

// Shrink the photo in-browser before upload: keeps the request small/fast and
// avoids shipping a multi-MB phone image to the vision endpoint.
async function downscale(file: File, maxDim = 1024, quality = 0.72): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new window.Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode failed"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function HeadPicker({
  value,
  onChange,
  compact = false,
}: {
  value: HeadTypeId;
  onChange: (id: HeadTypeId) => void;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<HeadGuessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const image = await downscale(file);
      const res = await fetch("/api/identify-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const j = (await res.json()) as { guess: HeadGuessResult | null; reason?: string };
      if (j.guess) {
        setResult(j.guess);
        onChange(j.guess.headTypeId);
      } else {
        setError(
          j.reason === "rate_limited" ? "Too many scans — give it a minute, or pick the closest match below."
          : j.reason === "scanner_unavailable" ? "Scanner is offline right now — pick the closest match below."
          : "Couldn't identify it from that photo — pick the closest match below.",
        );
      }
    } catch {
      setError("Couldn't read that image — try another photo, or pick the closest match below.");
    } finally {
      setScanning(false);
    }
  }

  const cols = compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div>
      <div className={`grid ${cols} gap-2`}>
        {HEAD_VISUAL.map((h) => {
          const active = value === h.id;
          return (
            <button
              type="button"
              key={h.id}
              onClick={() => { onChange(h.id); setResult(null); }}
              className={`group text-left rounded-xl border overflow-hidden transition ${
                active ? "border-green ring-2 ring-green" : "border-pine/15 hover:border-green/50"
              }`}
            >
              <div className="relative aspect-[4/3] bg-pine/5">
                <Image
                  src={h.img}
                  alt={h.short}
                  fill
                  sizes="(max-width: 640px) 33vw, 180px"
                  className="object-cover"
                />
                <span className="absolute bottom-1 right-1 rounded bg-pine/70 text-cloud text-[10px] px-1.5 py-0.5 tabular-nums">
                  {h.precipLabel}
                </span>
                {active && (
                  <span className="absolute top-1 left-1 rounded-full bg-green text-cloud w-5 h-5 grid place-items-center text-[11px]">✓</span>
                )}
              </div>
              <div className={compact ? "px-2 py-1.5" : "px-2.5 py-2"}>
                <p className={`text-sm font-semibold ${active ? "text-green" : "text-pine"}`}>{h.short}</p>
                {!compact && <p className="text-[11px] leading-snug text-pine/55 mt-0.5">{h.cue}</p>}
              </div>
            </button>
          );
        })}

        {/* Scan fallback occupies the last cell of the grid. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="rounded-xl border border-dashed border-green/50 bg-green/[0.03] hover:bg-green/5 transition flex flex-col items-center justify-center gap-1 p-3 text-center disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-green" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="12.5" r="3.2" />
          </svg>
          <span className="text-sm font-semibold text-green">{scanning ? "Scanning…" : "Not sure?"}</span>
          <span className="text-[11px] text-pine/55">{scanning ? "Reading your photo" : "Scan your head"}</span>
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />

      {result && (
        <div className="mt-2 rounded-lg bg-green/5 border border-green/20 px-3 py-2 text-xs text-pine/75">
          <span className="font-semibold text-green">
            {result.confidence >= 0.55 ? "Identified" : "Best guess"}: {headVisualById(result.headTypeId).short}
          </span>
          {result.confidence < 0.55 && " — please confirm it's right above."}
          {result.cues.length > 0 && <span className="text-pine/55"> · {result.cues.join(", ")}</span>}
          <span className="text-pine/40"> ({Math.round(result.confidence * 100)}% sure)</span>
        </div>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">{error}</p>
      )}
    </div>
  );
}

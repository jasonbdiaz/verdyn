import { ImageResponse } from "next/og";

// Dynamically rendered social-share card (no binary asset to maintain). Next.js
// auto-wires this as og:image and, via twitter-image re-export, twitter:image.
export const runtime = "edge";
export const alt = "Verdyn — Water like a pro.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #08231B 0%, #0E7C5A 100%)",
          color: "#F4FAF6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#8BE04A",
              color: "#08231B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            V
          </div>
          <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -0.5 }}>Verdyn</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
            Water like a pro.
          </div>
          <div style={{ fontSize: 36, color: "#C7E8D6", maxWidth: 900, lineHeight: 1.25 }}>
            Pro-grade irrigation intelligence for any B-hyve — up to 45% less water, zero effort.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: "#8BE04A" }}>
          <span style={{ fontWeight: 700 }}>verdyn.app</span>
          <span style={{ color: "#9CB4A8" }}>· free forever, no card</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

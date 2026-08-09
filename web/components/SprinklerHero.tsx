// Animated, on-brand sprinkler scene for the hero. Pure inline SVG + CSS so it
// works under the strict CSP, scales crisply, and respects reduced-motion.
import type { CSSProperties } from "react";

type DropStyle = CSSProperties & { "--dx": string; "--dy": string };

const DROPLETS: { x: number; r: number; dx: number; dy: number; delay: number }[] = [
  { x: 232, r: 5, dx: -90, dy: -150, delay: 0 },
  { x: 240, r: 6, dx: -30, dy: -190, delay: 0.3 },
  { x: 246, r: 5, dx: 40, dy: -185, delay: 0.6 },
  { x: 238, r: 4, dx: 110, dy: -150, delay: 0.9 },
  { x: 236, r: 6, dx: -140, dy: -110, delay: 1.2 },
  { x: 244, r: 4, dx: 150, dy: -100, delay: 1.5 },
  { x: 240, r: 5, dx: 0, dy: -205, delay: 1.8 },
];

export function SprinklerHero({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      className={className}
      role="img"
      aria-label="An illustration of a smart pop-up sprinkler watering a green lawn"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EAF7F0" />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
        <linearGradient id="lawn" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E7C5A" />
          <stop offset="1" stopColor="#8BE04A" />
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8BE04A" />
          <stop offset="1" stopColor="#16B6C4" />
        </linearGradient>
        <linearGradient id="spray" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#16B6C4" stopOpacity="0.05" />
          <stop offset="1" stopColor="#16B6C4" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="drop" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#BDEFF6" />
          <stop offset="1" stopColor="#16B6C4" />
        </radialGradient>
      </defs>

      {/* scene */}
      <rect x="0" y="0" width="480" height="400" rx="28" fill="url(#sky)" />

      {/* sun / orb */}
      <circle className="animate-float" cx="392" cy="92" r="46" fill="url(#sun)" opacity="0.9" />

      {/* sweeping spray fan behind droplets */}
      <path
        className="spray-fan"
        d="M240 300 L150 70 Q240 30 330 70 Z"
        fill="url(#spray)"
      />

      {/* droplets */}
      {DROPLETS.map((d, i) => (
        <circle
          key={i}
          className="droplet"
          cx={d.x}
          cy={296}
          r={d.r}
          fill="url(#drop)"
          style={{ "--dx": `${d.dx}px`, "--dy": `${d.dy}px`, animationDelay: `${d.delay}s` } as DropStyle}
        />
      ))}

      {/* lawn mound */}
      <path d="M0 330 Q240 280 480 330 L480 400 L0 400 Z" fill="url(#lawn)" />
      <ellipse cx="240" cy="332" rx="120" ry="16" fill="#08231B" opacity="0.12" />

      {/* pop-up sprinkler head */}
      <rect x="234" y="296" width="12" height="40" rx="6" fill="#0F3329" />
      <rect x="230" y="290" width="20" height="12" rx="6" fill="#08231B" />
      <circle cx="240" cy="292" r="4" fill="#8BE04A" />
    </svg>
  );
}

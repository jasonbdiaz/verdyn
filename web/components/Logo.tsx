// Verdyn logo — droplet-leaf mark with the brand gradient. Inline SVG so it
// inherits currentColor where needed and scales crisply.

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="verdyn-mark" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0E7C5A" />
          <stop offset="1" stopColor="#8BE04A" />
        </linearGradient>
      </defs>
      {/* droplet */}
      <path
        d="M24 4C24 4 8 20 8 31a16 16 0 0 0 32 0C40 20 24 4 24 4Z"
        fill="url(#verdyn-mark)"
      />
      {/* leaf vein, carved out */}
      <path
        d="M24 16c-5 4-8 9-8 15 4 0 8-2 10-6M24 16c0 6 0 12-2 19"
        stroke="#F4FAF6"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.92"
      />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <LogoMark size={size} />
      <span
        className="display font-bold text-pine"
        style={{ fontSize: size * 0.72, letterSpacing: "-0.03em" }}
      >
        Verdyn
      </span>
    </span>
  );
}

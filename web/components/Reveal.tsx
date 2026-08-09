"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Wraps children and fades/slides them in when they scroll into view.
// Respects prefers-reduced-motion via the CSS (.reveal rules).
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Content renders VISIBLE by default (SSR + no-JS safe). After mount we only
  // hide below-the-fold elements so they can animate in on scroll — anything
  // already on screen, or any environment without JS/IO, stays visible forever.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return; // no IO → stay visible

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // honor reduced-motion → no hide/animate

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const onScreen = r.top < vh * 0.95 && r.bottom > 0;
    if (onScreen) return; // already visible → leave it, no flash

    // Below the fold: hide now (off-screen, so no visible flicker), then reveal
    // as it scrolls in.
    setHidden(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setHidden(false);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);

    // Safety net: never leave anything hidden if the observer misfires.
    const failsafe = window.setTimeout(() => setHidden(false), 1500);
    return () => { io.disconnect(); window.clearTimeout(failsafe); };
  }, []);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      className={`reveal ${hidden ? "reveal-pre" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Component>
  );
}

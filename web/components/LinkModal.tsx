"use client";

// "Verdyn Link" — a Plaid-style connection modal. The flow mirrors Plaid Link:
//   pick your controller (institution) → secure credential card with heavy trust
//   signals → "connecting" → success → hand a session back to the caller.
// It maps cleanly onto Verdyn's existing security model: B-hyve credentials are
// used once to mint a session token (sealed server-side), and the raw password
// is never stored — exactly Plaid's promise.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONTROLLER_CATALOG,
  brandBySlug,
  type ControllerBrandInfo,
} from "@verdyn/core";
import { Logo } from "./Logo";
import { StatusBadge } from "./StatusBadge";

export type ConnectedZone = { deviceId: string; station: number; name: string };

type Screen = "select" | "form" | "notify" | "connecting" | "success";

export function LinkModal({
  open,
  onClose,
  onConnected,
  onDemo,
  presetSlug,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires after a successful connect with the controller's detected zones. */
  onConnected: (zones: ConnectedZone[], brand: ControllerBrandInfo) => void;
  /** "Explore with demo zones" — skips a real controller. */
  onDemo: () => void;
  /** When set, the modal opens straight into that brand's auth (no institution
   *  picker) — the brand was already chosen upstream in onboarding. */
  presetSlug?: string;
}) {
  const [screen, setScreen] = useState<Screen>("select");
  const [query, setQuery] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const brand = useMemo(() => (slug ? brandBySlug(slug) : undefined), [slug]);

  // Reset each time the modal opens. With a preset brand we jump straight into
  // its auth (Plaid-style: the institution was already chosen upstream).
  useEffect(() => {
    if (open) {
      setQuery("");
      setEmail("");
      setPassword("");
      setErr(null);
      if (presetSlug) {
        const b = brandBySlug(presetSlug);
        setSlug(presetSlug);
        setScreen(b?.status === "live" ? "form" : "notify");
      } else {
        setSlug(null);
        setScreen("select");
      }
    }
  }, [open, presetSlug]);

  // Escape closes (except mid-connect, where we don't want to orphan a request).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && screen !== "connecting") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, screen, onClose]);

  // Autofocus the credential field when we land on the form.
  useEffect(() => {
    if (screen === "form") emailRef.current?.focus();
  }, [screen]);

  if (!open) return null;

  const filtered = CONTROLLER_CATALOG.filter((b) =>
    b.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function pick(b: ControllerBrandInfo) {
    setSlug(b.slug);
    setErr(null);
    setScreen(b.status === "live" ? "form" : "notify");
  }

  async function connect() {
    if (!brand) return;
    setErr(null);
    setScreen("connecting");
    try {
      const r = await fetch("/api/bhyve/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Connection failed.");
      const flat: ConnectedZone[] = (j.devices ?? []).flatMap((d: { id: string; zones?: { station: number; name: string }[] }) =>
        (d.zones ?? []).map((z) => ({ deviceId: d.id, station: z.station, name: z.name })),
      );
      setScreen("success");
      // Hold the success checkmark briefly, then hand the session back.
      window.setTimeout(() => onConnected(flat, brand), 1100);
    } catch (e) {
      setErr((e as Error).message);
      setScreen("form");
    }
  }

  return (
    <div
      className="link-backdrop fixed inset-0 z-50 grid place-items-center bg-pine/45 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && screen !== "connecting") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect your controller"
        className="link-card w-full max-w-md overflow-hidden rounded-3xl bg-cloud shadow-2xl"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-pine/5 px-5 py-3.5">
          <div className="flex items-center gap-2">
            {!presetSlug && (screen === "form" || screen === "notify") ? (
              <button
                onClick={() => setScreen("select")}
                className="grid h-8 w-8 place-items-center rounded-full text-pine/50 hover:bg-pine/5 hover:text-pine transition"
                aria-label="Back"
              >
                ←
              </button>
            ) : (
              <Logo size={22} />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-pine/45">
            <LockGlyph /> Secure connection
          </div>
          <button
            onClick={onClose}
            disabled={screen === "connecting"}
            className="grid h-8 w-8 place-items-center rounded-full text-pine/40 hover:bg-pine/5 hover:text-pine transition disabled:opacity-30"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-6">
          {screen === "select" && (
            <>
              <h2 className="text-xl font-bold">Connect your controller</h2>
              <p className="mt-1 text-sm text-pine/60">
                Choose your smart sprinkler controller or hose timer to link it securely.
              </p>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="vinput mt-4"
                placeholder="Search controllers…"
                autoComplete="off"
              />
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {filtered.map((b) => (
                  <button
                    key={b.slug}
                    onClick={() => pick(b)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-pine/10 bg-cloud px-4 py-3 text-left transition hover:border-green/40 hover:bg-green/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mist text-pine/70">
                        {b.category === "hose_timer" ? "🚰" : "🎛️"}
                      </span>
                      <span className={`font-medium ${b.status === "live" ? "text-pine" : "text-pine/70"}`}>
                        {b.name}
                      </span>
                    </div>
                    <StatusBadge status={b.status} />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-pine/45">
                    No controllers match “{query}”.
                  </p>
                )}
              </div>
              <button onClick={onDemo} className="mt-4 w-full text-center text-sm font-semibold text-green hover:underline">
                Skip — explore with demo zones
              </button>
            </>
          )}

          {screen === "form" && brand && (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl brand-gradient text-2xl text-cloud">
                  {brand.category === "hose_timer" ? "🚰" : "🎛️"}
                </span>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{brand.name}</h2>
                  <p className="flex items-center gap-1 text-xs text-pine/50">
                    <LockGlyph /> Encrypted connection
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-pine/65">
                Sign in with your {brand.name} account. Verdyn uses it once to create a
                secure session token — <strong className="text-pine">your password is never stored.</strong>
              </p>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-pine/70">{brand.name} email</span>
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="vinput"
                  placeholder="you@example.com"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-medium text-pine/70">{brand.name} password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && email && password) connect(); }}
                  className="vinput"
                  placeholder="••••••••"
                />
              </label>
              {err && <p className="mt-2 text-sm text-ember">{err}</p>}

              <button
                onClick={connect}
                disabled={!email || !password}
                className="btn-primary mt-5 w-full"
              >
                <span className="inline-flex items-center justify-center gap-2"><LockGlyph /> Securely connect</span>
              </button>
              <button onClick={onDemo} className="mt-2 w-full text-center text-sm font-semibold text-pine/55 hover:text-green">
                Use demo zones instead
              </button>
            </>
          )}

          {screen === "notify" && brand && (
            <NotifyMe brand={brand} onDemo={onDemo} />
          )}

          {screen === "connecting" && brand && (
            <div className="py-10 text-center">
              <div className="mx-auto h-12 w-12 link-spinner rounded-full border-[3px] border-green/20 border-t-green" />
              <p className="mt-5 font-semibold text-pine">Securely connecting to {brand.name}…</p>
              <p className="mt-1 text-sm text-pine/55">Establishing an encrypted session. This only takes a moment.</p>
            </div>
          )}

          {screen === "success" && brand && (
            <div className="py-10 text-center">
              <span className="link-check mx-auto grid h-14 w-14 place-items-center rounded-full bg-green/15 text-2xl text-green">✓</span>
              <p className="mt-5 font-semibold text-pine">Connected to {brand.name}</p>
              <p className="mt-1 text-sm text-pine/55">Pulling in your zones…</p>
            </div>
          )}
        </div>

        {/* trust footer */}
        <div className="flex items-center justify-center gap-1.5 border-t border-pine/5 bg-mist/60 px-6 py-3 text-[11px] text-pine/45">
          <LockGlyph /> Secured by Verdyn · we store an encrypted token, never your password
        </div>
      </div>
    </div>
  );
}

function NotifyMe({ brand, onDemo }: { brand: ControllerBrandInfo; onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit() {
    setState("sending");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, brandSlug: brand.slug, source: "web" }),
      });
      if (!r.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green/15 text-xl text-green">✓</span>
        <p className="mt-4 font-semibold text-pine">You’re on the list</p>
        <p className="mt-1 text-sm text-pine/60">We’ll email you the moment {brand.name} support goes live.</p>
        <button onClick={onDemo} className="mt-5 w-full text-center text-sm font-semibold text-green hover:underline">
          Explore with demo zones now
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mist text-2xl">
          {brand.category === "hose_timer" ? "🚰" : "🎛️"}
        </span>
        <div>
          <h2 className="text-lg font-bold leading-tight">{brand.name}</h2>
          <p className="text-xs font-semibold text-clay">Coming soon</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-pine/65">
        Verdyn doesn’t run {brand.name} yet. Leave your email and we’ll let you know
        the day it’s ready.
      </p>
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="vinput mt-4"
        placeholder="you@example.com"
      />
      {state === "error" && <p className="mt-2 text-sm text-ember">Something went wrong — please try again.</p>}
      <button onClick={submit} disabled={state === "sending" || !email} className="btn-primary mt-4 w-full">
        {state === "sending" ? "Saving…" : "Notify me"}
      </button>
      <button onClick={onDemo} className="mt-2 w-full text-center text-sm font-semibold text-pine/55 hover:text-green">
        Or explore with demo zones
      </button>
    </>
  );
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="inline-block">
      <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" opacity="0.85" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import { useState } from "react";
import { CONTROLLER_CATALOG, type ControllerBrandInfo } from "@verdyn/core";
import { StatusBadge } from "@/components/StatusBadge";

const controllers = CONTROLLER_CATALOG.filter((b) => b.category === "controller");
const hoseTimers = CONTROLLER_CATALOG.filter((b) => b.category === "hose_timer");

type SubmitState = "idle" | "sending" | "done" | "error";

// The integrations strip + notify-me capture. Coming-soon brands are selectable;
// picking one reveals a single shared email field that signs the visitor up to be
// notified when that exact brand goes live (POST /api/waitlist). Live brands are
// static — they just connect during onboarding.
export function ControllerWaitlist() {
  const [selected, setSelected] = useState<ControllerBrandInfo | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  // Brands the visitor has already signed up for this session (for inline ✓).
  const [done, setDone] = useState<Set<string>>(new Set());

  function pick(b: ControllerBrandInfo) {
    setSelected(b);
    setState("idle");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, brandSlug: selected.slug, source: "web" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Something went wrong. Try again.");
        setState("error");
        return;
      }
      setDone((d) => new Set(d).add(selected.slug));
      setState("done");
      setEmail("");
    } catch {
      setError("Network error. Try again.");
      setState("error");
    }
  }

  return (
    <>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <BrandGroup title="Sprinkler controllers" brands={controllers} selected={selected} done={done} onPick={pick} />
        <BrandGroup title="Hose-bib & faucet timers" brands={hoseTimers} selected={selected} done={done} onPick={pick} />
      </div>

      {/* notify-me capture — appears once a coming-soon brand is selected */}
      <div className="mt-10 mx-auto max-w-xl rounded-2xl border border-pine/10 bg-mist p-6 sm:p-7">
        {state === "done" ? (
          <div className="text-center">
            <div className="text-2xl">📬</div>
            <p className="mt-2 font-semibold text-pine">
              You&apos;re on the list for {selected?.name}.
            </p>
            <p className="mt-1 text-sm text-pine/60">
              We&apos;ll email you the moment it&apos;s live. Want another brand? Just pick it above.
            </p>
          </div>
        ) : (
          <>
            <p className="text-center text-[15px] font-semibold text-pine">
              {selected
                ? `Get notified when ${selected.name} is live`
                : "Don't see yours live yet? Pick a brand above and we'll tell you when it lands."}
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Email address"
                className="flex-1 rounded-full border border-pine/15 bg-cloud px-5 py-3 text-pine outline-none focus:border-green/50 disabled:opacity-50"
                disabled={!selected || state === "sending"}
              />
              <button
                type="submit"
                disabled={!selected || state === "sending"}
                className="rounded-full px-6 py-3 font-semibold text-cloud brand-gradient shadow-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {state === "sending" ? "Adding…" : "Notify me"}
              </button>
            </form>
            {error && <p className="mt-3 text-center text-sm text-ember">{error}</p>}
            {!error && (
              <p className="mt-3 text-center text-xs text-pine/45">
                One email when it ships. No spam, unsubscribe anytime.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function BrandGroup({
  title,
  brands,
  selected,
  done,
  onPick,
}: {
  title: string;
  brands: ControllerBrandInfo[];
  selected: ControllerBrandInfo | null;
  done: Set<string>;
  onPick: (b: ControllerBrandInfo) => void;
}) {
  return (
    <div className="rounded-2xl bg-mist p-7 h-full border border-pine/5">
      <h3 className="text-lg font-semibold text-pine/80">{title}</h3>
      <ul className="mt-5 space-y-2.5">
        {brands.map((b) => {
          const live = b.status === "live";
          const isSelected = selected?.slug === b.slug;
          const signedUp = done.has(b.slug);
          const base =
            "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 border text-left transition";
          return (
            <li key={b.slug}>
              {live ? (
                <div className={`${base} bg-cloud border-pine/5`}>
                  <span className="font-medium text-pine">{b.name}</span>
                  <StatusBadge status={b.status} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onPick(b)}
                  aria-pressed={isSelected}
                  className={`group ${base} ${
                    isSelected
                      ? "bg-cloud border-green ring-1 ring-green"
                      : "bg-cloud border-pine/5 hover:border-green/40"
                  }`}
                >
                  <span className="font-medium text-pine/60">{b.name}</span>
                  <span className="inline-flex items-center gap-2">
                    {signedUp ? (
                      <span className="text-xs font-semibold text-green">✓ On the list</span>
                    ) : (
                      <span className={`text-xs font-semibold transition ${isSelected ? "text-green" : "text-green/40 group-hover:text-green"}`}>Notify me</span>
                    )}
                    <StatusBadge status={b.status} />
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

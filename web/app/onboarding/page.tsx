"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { saveIntent } from "@/lib/setup-intent";
import { LAUNCHED } from "@/lib/launch";
import ComingSoon from "@/components/ComingSoon";

// Pre-account onboarding. We collect the bare minimum (who it's for, which
// system) and then create the account FIRST — the magic link signs you in and
// drops you into the dashboard-style /setup continuation where you connect your
// controller and configure zones. Account before credentials.
type WStep = "audience" | "system" | "account";

const META: Record<WStep, { title: string; subtitle: string }> = {
  audience: {
    title: "First — who's this for?",
    subtitle: "Verdyn works for a single home or a lawn-care business managing many properties.",
  },
  system: {
    title: "What system do you have?",
    subtitle: "Verdyn runs your existing smart controller. We'll connect it securely right after you sign in.",
  },
  account: {
    title: "Create your Verdyn account",
    subtitle: "We'll email a secure sign-in link to start your free 14-day trial. No credit card — connect your controller once you're in.",
  },
};

export default function OnboardingPage() {
  // Hosted sign-up is gated until the payment portal is live. Self-hosters run
  // the full flow from their own deployment where LAUNCHED is on.
  if (!LAUNCHED) {
    return (
      <ComingSoon
        title="Verdyn accounts are coming soon"
        blurb="Hosted sign-up opens once our payment portal is live. Today the whole engine is open source — clone the repo and run your own instance in minutes, credentials never leaving your servers."
      />
    );
  }
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const router = useRouter();
  const [expert, setExpert] = useState(false);
  const [idx, setIdx] = useState(0);

  const [audience, setAudience] = useState<"homeowner" | "business" | null>(null);
  const [system, setSystem] = useState<"bhyve" | "others" | null>(null);

  const [acctEmail, setAcctEmail] = useState("");
  const [acctState, setAcctState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [acctDevLink, setAcctDevLink] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const stepIds: WStep[] = ["audience", "system", "account"];
  const step = stepIds[Math.min(idx, stepIds.length - 1)];
  const pct = Math.round(((idx + 1) / stepIds.length) * 100);
  const next = () => setIdx((i) => Math.min(stepIds.length - 1, i + 1));
  const back = () => setIdx((i) => Math.max(0, i - 1));

  // If they're already signed in (returning), skip straight to the continuation.
  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.authenticated) router.replace("/setup"); })
      .catch(() => {});
  }, [router]);

  // Persist the pre-account choices so they survive the magic-link round-trip
  // and the /setup continuation can pick them up.
  function persist(over: Partial<{ audience: "homeowner" | "business"; system: "bhyve" | "others"; expert: boolean }> = {}) {
    saveIntent({
      audience: over.audience ?? audience ?? "homeowner",
      system: over.system ?? system ?? "bhyve",
      expert: over.expert ?? expert,
    });
  }

  async function sendAccountLink() {
    persist();
    setAcctState("sending");
    setAcctDevLink(null);
    try {
      const r = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acctEmail }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not send the link.");
      setAcctState("sent");
      if (j.devLink) setAcctDevLink(j.devLink);
    } catch {
      setAcctState("error");
    }
  }

  // After the link is sent, poll for the session cookie — when they click the
  // link (here or on their phone) we flip to "signed in" and offer to continue.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (acctState !== "sent") return;
    pollRef.current = setInterval(() => {
      fetch("/api/account")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j?.authenticated) setSignedIn(true); })
        .catch(() => {});
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [acctState]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-6 h-16 flex items-center justify-between">
          <Logo size={26} />
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <span className={expert ? "text-pine/45" : "text-green"}>Basic</span>
            <button
              type="button"
              onClick={() => { setExpert((v) => !v); persist({ expert: !expert }); }}
              className={`relative h-6 w-11 rounded-full transition ${expert ? "brand-gradient" : "bg-pine/15"}`}
              aria-pressed={expert}
              aria-label="Toggle expert mode"
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cloud shadow transition-all ${expert ? "left-[1.45rem]" : "left-0.5"}`} />
            </button>
            <span className={expert ? "text-green" : "text-pine/45"}>Expert</span>
          </label>
        </div>
        <div className="h-1 bg-pine/5">
          <div className="h-1 brand-gradient transition-all" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-2xl px-6 py-10">
        <p className="text-sm font-semibold text-green">{`Step ${idx + 1} of ${stepIds.length}`}</p>
        <h1 className="mt-1 text-3xl font-bold">{META[step].title}</h1>
        <p className="mt-2 text-pine/65">{META[step].subtitle}</p>

        <div className="mt-8">
          {step === "audience" && (
            <>
              <ChoiceGrid
                options={[
                  { value: "homeowner", label: "My own lawn", note: "Smart, weather-based watering for your home." },
                  { value: "business", label: "I run a lawn-care business", note: "Manage every client address from one Pro dashboard." },
                ]}
                value={audience ?? ""}
                onChange={(v) => setAudience(v as "homeowner" | "business")}
              />
              {audience === "business" && (
                <Card className="mt-4 border-green/30 bg-green/5">
                  <p className="font-semibold text-pine">Verdyn Pro — sell AI-managed lawn service</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-pine/70">
                    <li>• Every property gets Expert-grade AI watering & local-rule compliance</li>
                    <li>• Manage all your client addresses from one dashboard</li>
                    <li>• Client-facing water-savings reporting you can put your name on</li>
                  </ul>
                  <p className="mt-3 text-xs text-pine/50">
                    Pro puts every client property in one dashboard. Sign in next to set up your portfolio.
                  </p>
                </Card>
              )}
            </>
          )}

          {step === "system" && (
            <div className="space-y-4">
              <ChoiceGrid
                options={[
                  { value: "bhyve", label: "B-hyve from Orbit", note: "Smart controllers and hose timers — fully automated today." },
                  { value: "others", label: "Other system", note: "Rachio, Rain Bird, Hunter & more — coming soon." },
                ]}
                value={system ?? ""}
                onChange={(v) => setSystem(v as "bhyve" | "others")}
              />
              {system === "others" && (
                <Card className="border-clay/30 bg-clay/5">
                  <p className="font-semibold text-pine">More systems are on the way</p>
                  <p className="mt-1 text-sm text-pine/65">
                    Verdyn only runs B-hyve today. Create your account now and explore your plan
                    with demo zones — we&apos;ll email you the day your system is supported.
                  </p>
                </Card>
              )}
            </div>
          )}

          {step === "account" && (
            <Card>
              {signedIn ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-green/15 text-lg text-green">✓</span>
                    <div>
                      <p className="font-semibold text-pine">You&apos;re signed in</p>
                      <p className="text-sm text-pine/60">Your account is active. Let&apos;s connect your controller.</p>
                    </div>
                  </div>
                  <button onClick={() => router.push("/setup")} className="btn-primary mt-5">
                    Continue setup →
                  </button>
                </>
              ) : acctState === "sent" ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-green/15 text-lg text-green">✓</span>
                    <div>
                      <p className="font-semibold text-pine">Secure link sent</p>
                      <p className="text-sm text-pine/60">Check {acctEmail} for your Verdyn sign-in link.</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-pine/65">
                    Tap the link in your email — it signs you in and brings you right back here to
                    finish setup. The link expires in 15 minutes and works once.
                  </p>
                  {acctDevLink && (
                    <div className="mt-4 rounded-xl border border-clay/30 bg-clay/5 p-3 text-xs">
                      <p className="font-semibold text-clay">Dev mode — email link</p>
                      <a href={acctDevLink} className="break-all text-green underline">{acctDevLink}</a>
                    </div>
                  )}
                  <button onClick={() => { setAcctState("idle"); setSignedIn(false); }} className="btn-ghost mt-3 px-0 text-sm">
                    Use a different email
                  </button>
                </>
              ) : (
                <>
                  <Field label="Your email">
                    <input
                      type="email" autoComplete="email" value={acctEmail}
                      onChange={(e) => setAcctEmail(e.target.value)}
                      className="vinput" placeholder="you@example.com"
                    />
                  </Field>
                  {acctState === "error" && (
                    <p className="mt-2 text-sm text-ember">Couldn&apos;t send the link — check the address and try again.</p>
                  )}
                  <button
                    onClick={sendAccountLink}
                    disabled={acctState === "sending" || !acctEmail}
                    className="btn-primary mt-4"
                  >
                    {acctState === "sending" ? "Sending…" : "Email me a secure link"}
                  </button>
                  <p className="mt-3 text-xs text-pine/45">
                    No credit card required. Signing in unlocks your free smart plan — yours
                    forever. Autopilot (hands-off automation) includes a 14-day free trial.
                  </p>
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-pine/5 bg-mist/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center justify-between">
          <button onClick={back} disabled={idx === 0} className="btn-ghost disabled:opacity-30">Back</button>
          {step === "account" ? (
            <span className="text-xs text-pine/40">{signedIn ? "" : "Check your email to continue"}</span>
          ) : step === "audience" && audience === "business" ? (
            <button onClick={() => { persist({ audience: "business" }); router.push("/pro"); }} className="btn-primary">Continue to Pro →</button>
          ) : (
            <button
              onClick={() => { persist(); next(); }}
              disabled={(step === "audience" && !audience) || (step === "system" && !system)}
              className="btn-primary disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </footer>

      <StyleHelpers />
    </main>
  );
}

// ── small helpers ───────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-cloud border border-pine/5 p-6 ${className}`}>{children}</div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-pine/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ChoiceGrid({
  options, value, onChange,
}: {
  options: { value: string; label: string; note?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`text-left rounded-2xl border p-5 transition ${active ? "border-green bg-green/5 ring-1 ring-green" : "border-pine/10 bg-cloud hover:border-green/40"}`}
          >
            <span className="font-semibold block">{o.label}</span>
            {o.note && <span className="text-sm text-pine/55 block mt-1">{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

function StyleHelpers() {
  return (
    <style>{`
      .vinput { width:100%; border:1px solid rgba(8,35,27,.12); border-radius:0.9rem;
        padding:0.7rem 0.9rem; background:#fff; outline:none; transition:border-color .15s; }
      .vinput:focus { border-color:#0E7C5A; box-shadow:0 0 0 3px rgba(14,124,90,.12); }
      .btn-primary { background:linear-gradient(135deg,#0E7C5A,#8BE04A); color:#fff;
        font-weight:600; padding:0.7rem 1.4rem; border-radius:9999px; transition:opacity .15s; display:inline-flex; align-items:center; }
      .btn-primary:hover { opacity:.9; }
      .btn-primary:disabled { opacity:.4; cursor:not-allowed; }
      .btn-ghost { font-weight:600; color:#08231B; padding:0.7rem 1.2rem; border-radius:9999px; }
      .btn-ghost:hover { color:#0E7C5A; }
    `}</style>
  );
}

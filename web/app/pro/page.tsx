"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SOIL_TYPES, type PlanStatus, type WaterSavings } from "@verdyn/core";
import { Logo } from "@/components/Logo";

type Account = { authenticated: boolean; pro: boolean; accountType: string | null };

type Row = {
  id: string;
  label: string;
  address: string | null;
  zip: string;
  zones?: number;
  todayStatus?: PlanStatus;
  restriction?: { label: string; county: string | null; source: string; needsVerification: boolean } | null;
  savings?: WaterSavings;
  ok: boolean;
};

type Overview = { properties: Row[]; aggregate: WaterSavings; count: number; limit: number };

const STATUS: Record<PlanStatus, { c: string; t: string }> = {
  scheduled: { c: "bg-green/10 text-green", t: "Watering today" },
  adjusted: { c: "bg-clay/15 text-clay", t: "Adjusted" },
  skipped: { c: "bg-ember/10 text-ember", t: "Skipped" },
  rest: { c: "bg-rest/15 text-rest", t: "Rest day" },
};

const gal = (n: number) => n.toLocaleString();

export default function ProPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    const r = await fetch("/api/properties/overview");
    if (r.ok) setOv(await r.json());
  }, []);

  useEffect(() => {
    (async () => {
      let a: Account = await (await fetch("/api/account")).json();
      // Mark this account as a business so future logins route here. This also
      // bumps a running free trial to Pro server-side, so re-read the account to
      // pick up Pro access on this first load.
      if (a.authenticated && a.accountType !== "business") {
        try {
          await fetch("/api/account/type", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "business" }),
          });
          a = await (await fetch("/api/account")).json();
        } catch {
          /* keep the original account read; the gate will guide them */
        }
      }
      setAccount(a);
      if (a.authenticated && a.pro) await loadOverview();
      setLoading(false);
    })();
  }, [loadOverview]);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-mist/80 border-b border-pine/5">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/"><Logo /></Link>
            <span className="rounded-full brand-gradient px-2.5 py-0.5 text-xs font-bold text-cloud">Pro</span>
          </div>
          {account?.authenticated && (
            <button
              onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/"; }}
              className="text-sm font-medium text-pine/60 hover:text-green"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {loading ? (
          <p className="text-pine/55">Loading your portfolio…</p>
        ) : !account?.authenticated ? (
          <Gate
            title="Sign in to start Verdyn Pro free"
            body="Pro lets your lawn-care business manage every client's watering — AI-tuned, restriction-compliant, with water-savings reports you can hand to customers. Your first 14 days are free, no card required."
            cta={{ href: "/login", label: "Sign in — 14 days free" }}
          />
        ) : !account.pro ? (
          <Gate
            title="Start Verdyn Pro"
            body="Your account is ready. Activate Pro to manage your client properties from one dashboard, with AI watering and client-facing savings reporting on every one."
            cta={{ href: "/pricing", label: "See the Pro tier" }}
          />
        ) : (
          <ProDashboard ov={ov} reload={loadOverview} />
        )}
      </div>
    </main>
  );
}

function Gate({ title, body, cta }: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <span className="inline-block rounded-full brand-gradient px-3 py-1 text-xs font-bold text-cloud">Verdyn Pro</span>
      <h1 className="mt-4 display text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-pine/65">{body}</p>
      <Link href={cta.href} className="inline-block mt-7 rounded-full px-7 py-3.5 text-cloud font-semibold brand-gradient shadow-lg shadow-green/20 hover:opacity-90 transition">
        {cta.label}
      </Link>
    </div>
  );
}

function ProDashboard({ ov, reload }: { ov: Overview | null; reload: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const props = ov?.properties ?? [];
  const atLimit = ov ? ov.count >= ov.limit : false;

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-3xl font-bold">Your properties</h1>
          <p className="mt-1 text-pine/60">
            {ov ? `${ov.count} of ${ov.limit} addresses` : "—"} under AI-managed watering.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={atLimit}
          className="rounded-full px-5 py-2.5 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition disabled:opacity-40"
        >
          {adding ? "Close" : "+ Add property"}
        </button>
      </div>

      {/* portfolio savings */}
      {ov && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Properties" value={`${ov.count}`} sub={`of ${ov.limit}`} />
          <Stat label="Water saved / wk" value={`${gal(ov.aggregate.savedGal)} gal`} sub="vs. a daily timer" highlight />
          <Stat label="Avg. reduction" value={`${ov.aggregate.savedPct}%`} sub="across portfolio" />
        </div>
      )}

      {atLimit && (
        <p className="mt-4 text-sm text-clay">
          You&apos;ve reached your plan&apos;s {ov?.limit}-property limit.{" "}
          <Link href="/pricing" className="font-semibold text-green underline underline-offset-2">
            Upgrade to manage more →
          </Link>
        </p>
      )}

      {adding && <AddPropertyForm onDone={async () => { setAdding(false); await reload(); }} />}

      <div className="mt-8 space-y-3">
        {props.length === 0 && !adding && (
          <div className="rounded-2xl border border-dashed border-pine/15 p-10 text-center text-pine/55">
            No properties yet. Add your first client address to start managing it.
          </div>
        )}
        {props.map((p) => (
          <PropertyCard key={p.id} p={p} onDelete={async () => {
            await fetch(`/api/properties?id=${p.id}`, { method: "DELETE" });
            await reload();
          }} />
        ))}
      </div>
    </>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-green/30 bg-green/5" : "border-pine/10 bg-cloud"}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-pine/45">{label}</div>
      <div className={`mt-1 display text-2xl font-bold ${highlight ? "text-green" : "text-pine"}`}>{value}</div>
      {sub && <div className="text-xs text-pine/50">{sub}</div>}
    </div>
  );
}

function PropertyCard({ p, onDelete }: { p: Row; onDelete: () => void }) {
  const st = p.todayStatus ? STATUS[p.todayStatus] : null;
  return (
    <div className="rounded-2xl bg-cloud border border-pine/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-pine">{p.label}</div>
          <div className="text-sm text-pine/55">{p.address ? `${p.address} · ` : ""}{p.zip}{p.zones ? ` · ${p.zones} zones` : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          {st && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>}
          <button onClick={onDelete} className="text-pine/35 hover:text-ember text-sm" aria-label="Remove property">✕</button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-mist/60 px-3 py-2.5">
          <div className="text-xs font-semibold text-pine/45">Local compliance</div>
          {p.restriction ? (
            <div className="mt-0.5 text-sm text-pine/75">
              {p.restriction.county ? `${p.restriction.county}: ` : ""}{p.restriction.label}
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.restriction.source === "builtin" ? "bg-pine/10 text-pine/55" : "bg-green/10 text-green"}`}>
                {p.restriction.source === "builtin" ? "Built-in" : "AI-researched"}
              </span>
            </div>
          ) : <div className="mt-0.5 text-sm text-pine/50">—</div>}
        </div>
        <div className="rounded-xl bg-mist/60 px-3 py-2.5">
          <div className="text-xs font-semibold text-pine/45">Water saved / wk</div>
          <div className="mt-0.5 text-sm text-pine/75">
            {p.savings ? <><strong className="text-green">{gal(p.savings.savedGal)} gal</strong> · {p.savings.savedPct}% less</> : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPropertyForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [soil, setSoil] = useState("loam");
  const [parity, setParity] = useState<"odd" | "even">("odd");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, address, zip, soil, parity }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Could not add property."); setBusy(false); return; }
      onDone();
    } catch { setErr("Network error."); setBusy(false); }
  }

  return (
    <div className="mt-6 rounded-2xl border border-green/30 bg-green/5 p-5">
      <p className="font-semibold text-pine">Add a property</p>
      <p className="text-xs text-pine/55 mt-0.5">Verdyn researches the address&apos;s local watering rules automatically.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="vinput" placeholder="Label (e.g. Smith residence)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="vinput" placeholder="Street address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className="vinput" inputMode="numeric" maxLength={5} placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} />
        <select className="vinput" value={soil} onChange={(e) => setSoil(e.target.value)}>
          {SOIL_TYPES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="vinput" value={parity} onChange={(e) => setParity(e.target.value as "odd" | "even")}>
          <option value="odd">Odd address</option>
          <option value="even">Even address</option>
        </select>
      </div>
      {err && <p className="mt-2 text-sm text-ember">{err}</p>}
      <button
        onClick={submit}
        disabled={busy || !label.trim() || zip.length !== 5}
        className="mt-4 rounded-full px-5 py-2.5 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition disabled:opacity-40"
      >
        {busy ? "Adding…" : "Add property"}
      </button>

      <style>{`
        .vinput { width:100%; border:1px solid rgba(8,35,27,.12); border-radius:0.9rem;
          padding:0.7rem 0.9rem; background:#fff; outline:none; transition:border-color .15s; }
        .vinput:focus { border-color:#0E7C5A; box-shadow:0 0 0 3px rgba(14,124,90,.12); }
      `}</style>
    </div>
  );
}

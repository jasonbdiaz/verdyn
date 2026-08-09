"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GRASS_TYPES, climateZoneForZip, policyForZip, plantById,
  type LawnProfile, type DailyPlan, type WeatherInput, type PlanStatus,
  type DecisionFactor, type ZoneOutcome, type Anomaly,
  type ComplianceChange, type ComplianceLogEntry,
} from "@verdyn/core";
import { Logo } from "@/components/Logo";
import AgentConnect from "@/components/AgentConnect";
import { loadProfile, saveProfile, clearProfile } from "@/lib/profile";

type CancelResult = {
  canceledAt: string;
  stopped: string[];
  accessRevoked: boolean;
  warning: string | null;
};

const STATUS_STYLE: Record<PlanStatus, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-green/10", text: "text-green", label: "Watering" },
  adjusted: { bg: "bg-clay/15", text: "text-clay", label: "Adjusted" },
  skipped: { bg: "bg-ember/10", text: "text-ember", label: "Skipped" },
  rest: { bg: "bg-rest/15", text: "text-rest", label: "Rest day" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type RunRow = {
  zoneId: string; runDate: string; cycleTime: string;
  minutes: number | null; status: string; detail: string | null; createdAt: string;
};
type AutoRunState = {
  linked: boolean; status: "linked" | "reauth_needed"; autoRun: boolean;
  entitled: boolean; runs: RunRow[];
};
type AccountState = {
  authenticated: boolean; tier: string | null; active: boolean;
  status: string; accountType: string | null; pro: boolean;
  comped: boolean; trialEnd: string | null;
};

// Human label + tint for each run-ledger status.
const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  ran: { label: "Watered", cls: "bg-green/15 text-green" },
  wind_skip: { label: "Wind skip", cls: "bg-clay/15 text-clay" },
  skipped_window: { label: "Outside window", cls: "bg-clay/15 text-clay" },
  reauth_needed: { label: "Reconnect needed", cls: "bg-ember/15 text-ember" },
  error: { label: "Error", cls: "bg-ember/15 text-ember" },
};

export default function Dashboard() {
  const [profile, setProfile] = useState<LawnProfile | null>(null);
  const [data, setData] = useState<{ today: DailyPlan; week: DailyPlan[]; weather: WeatherInput } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gate, setGate] = useState<{ kind: "auth" | "upgrade"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);
  const [health, setHealth] = useState<{ anomalies: Anomaly[]; state: string; monitoredZones: number } | null>(null);
  const [compliance, setCompliance] = useState<{ changes: ComplianceChange[]; log: ComplianceLogEntry[] } | null>(null);
  const [auto, setAuto] = useState<AutoRunState | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [acct, setAcct] = useState<AccountState | null>(null);
  const [acctChecked, setAcctChecked] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { setLoading(false); return; }
    setProfile(p);
    // A canceled account has had its access revoked server-side — don't even
    // request a plan, since there's nothing Verdyn can run anymore.
    if (p.subscriptionStatus === "canceled") { setLoading(false); return; }
    fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send the browser's IANA timezone so automated watering fires cycles at
      // the correct local wall-clock hour (falls back to ZIP-derived zone).
      body: JSON.stringify({
        profile: p,
        week: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
      .then(async (r) => {
        const j = await r.json();
        // The plan engine is entitlement-gated: 401 = sign in first,
        // 402 = entitlement inactive. Show a wall, not an error.
        if (r.status === 401 || r.status === 402) {
          setGate({ kind: r.status === 401 ? "auth" : "upgrade", message: j.error });
          return;
        }
        if (!r.ok) throw new Error(j.error ?? "Could not build plan.");
        setData({ today: j.today, week: j.week, weather: j.weather });

        // F3 — proactive compliance: surface rule changes + the audit log.
        fetch("/api/compliance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: p, addressLabel: `${p.zip} lawn` }),
        }).then((cr) => (cr.ok ? cr.json() : null))
          .then((cj) => { if (cj) setCompliance({ changes: cj.changes ?? [], log: cj.log ?? [] }); })
          .catch(() => {});

        // F2 — runtime anomaly detection (system health). Samples flow once a
        // B-hyve history ingest lands; for now this reports the monitoring state.
        fetch("/api/anomalies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: p, samples: [] }),
        }).then((ar) => (ar.ok ? ar.json() : null))
          .then((aj) => { if (aj) setHealth({ anomalies: aj.anomalies ?? [], state: aj.state, monitoredZones: aj.monitoredZones }); })
          .catch(() => {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Automated-watering status + run history (independent of the plan fetch; a
  // 401 when signed out just leaves the panel hidden).
  useEffect(() => {
    fetch("/api/auto-run")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AutoRunState | null) => { if (j) setAuto(j); })
      .catch(() => {});
  }, []);

  // Account/entitlement status — drives the trial-countdown banner (signed-in).
  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AccountState | null) => { if (j?.authenticated) setAcct(j); })
      .catch(() => {})
      .finally(() => setAcctChecked(true));
  }, []);

  async function toggleAutoRun(on: boolean) {
    setAutoSaving(true);
    try {
      const r = await fetch("/api/auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRun: on }),
      });
      if (r.ok) setAuto((a) => (a ? { ...a, autoRun: on } : a));
    } catch {
      /* leave the toggle as-is on failure */
    } finally {
      setAutoSaving(false);
    }
  }

  async function disconnect() {
    try {
      await fetch("/api/bhyve/disconnect", { method: "POST" });
    } catch {
      /* clearing local state is the important part */
    }
    clearProfile();
    window.location.href = "/";
  }

  // Restart onboarding: wipe the saved setup server-side (controller link, lawn
  // profile, run + compliance history) and locally, then drop into the flow so
  // the user re-detects their B-hyve devices from scratch. The account and its
  // entitlement are kept — this is a config reset, not an account deletion.
  async function restartOnboarding() {
    setRestarting(true);
    setErr(null);
    try {
      const r = await fetch("/api/account/reset", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Could not reset. Try again.");
    } catch (e) {
      setErr((e as Error).message);
      setRestarting(false);
      return;
    }
    clearProfile();
    window.location.href = "/onboarding";
  }

  async function cancelSubscription() {
    if (!profile) return;
    setCanceling(true);
    setErr(null);
    try {
      const r = await fetch("/api/subscription/cancel", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not cancel. Try again.");
      // Persist the canceled state so the access-off view survives a reload.
      const updated: LawnProfile = {
        ...profile,
        subscriptionStatus: "canceled",
        canceledAt: j.canceledAt,
      };
      saveProfile(updated);
      setProfile(updated);
      setData(null);
      setCancelResult({
        canceledAt: j.canceledAt,
        stopped: j.stopped ?? [],
        accessRevoked: j.accessRevoked ?? true,
        warning: j.warning ?? null,
      });
      setConfirmCancel(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCanceling(false);
    }
  }

  // Reactivating means reconnecting B-hyve — we revoked our token on cancel and
  // intentionally hold none of it, so the only way back is a fresh sign-in.
  function reactivate() {
    if (!profile) return;
    const updated: LawnProfile = { ...profile, subscriptionStatus: "active", canceledAt: null };
    saveProfile(updated);
    window.location.href = "/setup";
  }

  if (loading) return <Centered><p className="text-pine/50">Building today's plan…</p></Centered>;

  if (!profile) {
    // Wait for the account check so we don't flash the wrong call-to-action.
    if (!acctChecked) return <Centered><p className="text-pine/50">Loading…</p></Centered>;
    // Signed in but nothing configured yet — this is the post-SSO landing for a
    // brand-new account. Welcome them and continue onboarding in /setup.
    if (acct) {
      return (
        <Centered>
          <div className="max-w-md text-center">
            <Logo />
            <span className="mt-6 inline-block rounded-full brand-gradient px-3 py-1 text-xs font-bold text-cloud">
              {acct.comped ? "Owner account" : "Expert account"}
            </span>
            <h1 className="mt-4 text-2xl font-bold">Welcome to Verdyn 👋</h1>
            <p className="mt-3 text-pine/65">
              You&apos;re signed in. Let&apos;s connect your controller and set up your zones —
              takes about two minutes.
            </p>
            <Link
              href="/setup"
              className="inline-block mt-7 rounded-full px-7 py-3.5 text-cloud font-semibold brand-gradient shadow-lg shadow-green/20 hover:opacity-90 transition"
            >
              Connect & finish setup →
            </Link>
          </div>
          <DashStyles />
        </Centered>
      );
    }
    // Not signed in — start with account creation.
    return (
      <Centered>
        <div className="text-center">
          <Logo />
          <p className="mt-6 text-pine/65">No lawn set up yet.</p>
          <Link href="/onboarding" className="inline-block mt-4 btn-primary-link">Get started</Link>
        </div>
        <DashStyles />
      </Centered>
    );
  }

  if (profile.subscriptionStatus === "canceled") {
    const stopped = cancelResult?.stopped ?? [];
    const canceledAt = cancelResult?.canceledAt ?? profile.canceledAt ?? null;
    return (
      <main className="min-h-screen">
        <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
            <Logo size={26} />
            <button onClick={disconnect} className="text-sm font-medium text-pine/60 hover:text-ember">Disconnect</button>
          </div>
        </header>

        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-2xl bg-cloud border border-pine/5 overflow-hidden">
            <div className="px-6 py-5 bg-ember/10">
              <h1 className="text-xl font-bold text-ember">Subscription canceled — Verdyn is off</h1>
              <p className="mt-1 text-sm text-pine/65">
                We stopped all watering Verdyn was running and revoked our access to your B-hyve.
                Verdyn will not send any further commands to your controller.
                {canceledAt && ` Canceled ${new Date(canceledAt).toLocaleDateString()}.`}
              </p>
            </div>

            <div className="px-6 py-5 space-y-3 text-[15px] text-pine/70">
              {stopped.length > 0 && (
                <p>✅ Stopped watering on: <span className="font-medium text-pine">{stopped.join(", ")}</span>.</p>
              )}
              {cancelResult?.warning && (
                <p className="rounded-lg bg-clay/15 text-clay px-4 py-3 text-sm">
                  ⚠️ {cancelResult.warning} Please confirm it's off in the B-hyve app directly.
                </p>
              )}
              <p>
                Your controller and B-hyve account are untouched and remain entirely yours.
                Your lawn’s built-in B-hyve schedule (if any) is unaffected — you can manage it
                in the B-hyve app at any time.
              </p>
              <p className="text-sm text-pine/55">
                Changed your mind? Reactivate to reconnect your B-hyve and turn Verdyn back on.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-pine/5 flex flex-wrap gap-3">
              <button onClick={reactivate} className="rounded-full px-6 py-2.5 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition">
                Reactivate Verdyn
              </button>
              <button onClick={disconnect} className="rounded-full px-6 py-2.5 font-semibold text-pine border border-pine/15 hover:border-ember/40 hover:text-ember transition">
                Delete my data
              </button>
            </div>
          </div>
        </div>
        <DashStyles />
      </main>
    );
  }

  // Entitlement wall — signed out, or the free trial has lapsed. Onboarding/
  // setup stays anonymous; the engine itself requires an active entitlement.
  if (gate) {
    const auth = gate.kind === "auth";
    return (
      <Centered>
        <div className="max-w-md text-center">
          <Logo />
          <span className="mt-6 inline-block rounded-full brand-gradient px-3 py-1 text-xs font-bold text-cloud">
            {auth ? "Free forever" : "Autopilot paused"}
          </span>
          <h1 className="mt-4 text-2xl font-bold">
            {auth ? "Sign in to see your free smart plan" : "Keep Verdyn running"}
          </h1>
          <p className="mt-3 text-pine/65">{gate.message}</p>
          <Link
            href={auth ? "/login" : "/pricing"}
            className="inline-block mt-7 rounded-full px-7 py-3.5 text-cloud font-semibold brand-gradient shadow-lg shadow-green/20 hover:opacity-90 transition"
          >
            {auth ? "Sign in — free" : "See plans"}
          </Link>
          <p className="mt-4 text-sm text-pine/45">
            Your lawn setup is saved on this device — it&apos;ll be here when you&apos;re back.
          </p>
        </div>
        <DashStyles />
      </Centered>
    );
  }

  const today = data?.today;

  return (
    <main className="min-h-screen">
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <Logo size={26} />
          <div className="flex items-center gap-4">
            <Link href="/setup" className="text-sm font-medium text-pine/60 hover:text-green">Edit setup</Link>
            <button onClick={disconnect} className="text-sm font-medium text-pine/60 hover:text-ember">Disconnect</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* location bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pine/60">
          <span>📍 {profile.zip} · {climateZoneForZip(profile.zip).label}</span>
          <span>📋 {policyForZip(profile.zip).label}</span>
          {data?.weather && (
            <span>🌤️ {Math.round(data.weather.forecastHighF)}°F · {data.weather.precipChancePct}% rain · {Math.round(data.weather.windMph)} mph</span>
          )}
        </div>

        {acct && <TrialBanner acct={acct} />}

        {err && <div className="mt-6 rounded-xl bg-ember/10 text-ember p-4 text-sm">{err}</div>}

        {/* today */}
        {today && (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Today</h1>
              <PhaseBadge phase={today.phase} />
            </div>

            <div className="mt-4 rounded-2xl bg-cloud border border-pine/5 overflow-hidden">
              <div className={`px-6 py-4 ${STATUS_STYLE[today.status].bg}`}>
                <span className={`font-semibold ${STATUS_STYLE[today.status].text}`}>
                  {STATUS_STYLE[today.status].label}
                  {today.multiplier !== 1 && today.cycles.length > 0 && ` · ${Math.round(today.multiplier * 100)}% runtime`}
                </span>
              </div>

              {today.cycles.length > 0 ? (
                <ul className="divide-y divide-pine/5">
                  {today.cycles.map((c, i) => (
                    <li key={i} className="px-6 py-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{c.zoneName}</span>
                        <span className="ml-2 text-xs uppercase tracking-wide text-pine/40">{c.cycleType}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold tabular-nums">{c.time}</span>
                        <span className="text-pine/55"> · {c.minutes} min · {c.inches}"</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-5 text-pine/60">
                  {today.zoneOutcomes[0]?.reason ?? "No watering scheduled today."}
                </div>
              )}

              <WhyToday plan={today} />
            </div>
          </section>
        )}

        {/* 7-day preview */}
        {data?.week && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Next 7 days</h2>
            <p className="text-sm text-pine/50 mb-3">Base schedule — actual runs adjust to live weather each morning.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.week.map((d) => {
                const wd = WEEKDAYS[new Date(d.date + "T00:00:00Z").getUTCDay()];
                const st = STATUS_STYLE[d.status];
                const mins = d.cycles.reduce((s, c) => s + c.minutes, 0);
                return (
                  <div key={d.date} className="rounded-xl bg-cloud border border-pine/5 px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{wd}</span>
                      <span className="text-pine/40 text-sm ml-2">{d.date.slice(5)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.cycles.length > 0 && <span className="text-sm text-pine/55 tabular-nums">{mins} min</span>}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* zones */}
        <section className="mt-10">
          <h2 className="text-xl font-bold mb-3">Your zones</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {profile.zones.map((z) => (
              <div key={z.id} className="rounded-xl bg-cloud border border-pine/5 px-4 py-3">
                <span className="font-semibold">{z.name}</span>
                <p className="text-sm text-pine/55 mt-0.5">
                  {plantById(z.plantTypeId).usesGrass
                    ? GRASS_TYPES.find((g) => g.id === z.grassTypeId)?.name
                    : plantById(z.plantTypeId).name}
                  {profile.expertMode && ` · ${z.sun.replace("_", " ")} · ${z.slope}`}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Automated watering — link status, the run toggle, and run history. */}
        {auto && (auto.linked || auto.runs.length > 0) && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-xl font-bold">Automatic watering</h2>
              {auto.linked && auto.status === "linked" && (
                <button
                  type="button"
                  onClick={() => toggleAutoRun(!auto.autoRun)}
                  disabled={autoSaving}
                  aria-pressed={auto.autoRun}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                    auto.autoRun ? "bg-green" : "bg-pine/20"
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-cloud shadow transition ${auto.autoRun ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              )}
            </div>

            {auto.status === "reauth_needed" ? (
              <div className="rounded-xl bg-ember/10 border border-ember/20 px-4 py-4 flex items-start gap-3">
                <span aria-hidden className="text-lg">🔌</span>
                <div>
                  <p className="font-medium text-pine">Reconnect your B-hyve.</p>
                  <p className="text-sm text-pine/60 mt-0.5">
                    Your saved B-hyve session expired, so Verdyn paused automatic watering. Reconnect to resume — it takes a few seconds.
                  </p>
                  <Link href="/setup" className="inline-block mt-2 text-sm font-semibold text-green hover:underline">
                    Reconnect →
                  </Link>
                </div>
              </div>
            ) : !auto.linked ? (
              <div className="rounded-xl bg-cloud border border-pine/5 px-4 py-4 text-sm text-pine/60">
                Connect your B-hyve during setup to let Verdyn run your plan automatically.
              </div>
            ) : (
              <div className="rounded-xl bg-cloud border border-pine/5 px-4 py-4 flex items-start gap-3">
                <span aria-hidden className="text-lg">{auto.autoRun ? "🟢" : "⏸️"}</span>
                <div>
                  <p className="font-medium text-pine">
                    {auto.autoRun
                      ? "Verdyn runs your plan automatically."
                      : "Automatic watering is paused."}
                  </p>
                  <p className="text-sm text-pine/55 mt-0.5">
                    {auto.autoRun
                      ? "Each morning Verdyn starts the right zones for the right minutes on your controller — within your watering window, skipping for wind and rain. Nothing to start by hand."
                      : "Your schedule is still calculated, but Verdyn won't start any zones until you switch this back on."}
                  </p>
                  {auto.autoRun && !auto.entitled && (
                    <p className="text-sm text-clay mt-2">
                      Watering is on hold until you choose a plan — <Link href="/pricing" className="font-semibold underline">see plans</Link>.
                    </p>
                  )}
                </div>
              </div>
            )}

            {auto.runs.length > 0 && (
              <details className="mt-2 rounded-xl bg-cloud border border-pine/5 overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
                  <span className="text-sm font-semibold text-pine/70">Recent runs ({auto.runs.length})</span>
                  <span className="text-xs text-pine/40">controller activity</span>
                </summary>
                <ul className="divide-y divide-pine/5">
                  {auto.runs.slice(0, 12).map((r, i) => {
                    const s = RUN_STATUS[r.status] ?? { label: r.status, cls: "bg-pine/10 text-pine/60" };
                    return (
                      <li key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                        <span className="text-pine/40 tabular-nums shrink-0 w-28">{r.runDate} {r.cycleTime}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
                        <span className="text-pine/65 truncate">
                          {r.detail ?? r.zoneId}{r.minutes != null && r.status === "ran" ? ` · ${r.minutes} min` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* Expert (agentic) tier — MCP agent key management. */}
        <AgentConnect />

        {/* F2 — system health (runtime anomaly detection) */}
        {health && (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-3">System health</h2>
            {health.anomalies.length === 0 ? (
              <div className="rounded-xl bg-cloud border border-pine/5 px-4 py-4 flex items-start gap-3">
                <span aria-hidden className="text-lg">{health.state === "healthy" ? "✅" : "🟢"}</span>
                <div>
                  <p className="font-medium text-pine">
                    {health.state === "healthy" ? "All zones running normally." : `Monitoring ${health.monitoredZones} zone${health.monitoredZones === 1 ? "" : "s"}.`}
                  </p>
                  <p className="text-sm text-pine/55 mt-0.5">
                    Verdyn watches each zone&apos;s runtime for leaks, broken heads, and stuck or dead valves — no extra hardware. We&apos;ll alert you the moment a pattern looks wrong.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {health.anomalies.map((a, i) => (
                  <div key={i} className={`rounded-xl border px-4 py-3 ${a.severity === "critical" ? "bg-ember/10 border-ember/20" : a.severity === "warning" ? "bg-clay/10 border-clay/20" : "bg-cloud border-pine/5"}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-pine">{a.zoneName}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.severity === "critical" ? "bg-ember/15 text-ember" : a.severity === "warning" ? "bg-clay/15 text-clay" : "bg-pine/10 text-pine/60"}`}>
                        {a.kind.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-pine/70 mt-1">{a.detail}</p>
                    <p className="text-sm text-pine/55 mt-1">→ {a.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* F3 — proactive compliance + audit log */}
        {compliance && (compliance.changes.length > 0 || compliance.log.length > 0) && (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-3">Compliance</h2>
            {compliance.changes.map((c, i) => (
              <div key={i} className="rounded-xl bg-tide/10 border border-tide/20 px-4 py-3 mb-2">
                <p className="font-semibold text-pine">{c.title}</p>
                <p className="text-sm text-pine/65 mt-0.5">{c.message}</p>
              </div>
            ))}
            {compliance.log.length > 0 && (
              <details className="rounded-xl bg-cloud border border-pine/5 overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
                  <span className="text-sm font-semibold text-pine/70">Compliance log ({compliance.log.length})</span>
                  <span className="text-xs text-pine/40">timestamped record</span>
                </summary>
                <ul className="divide-y divide-pine/5">
                  {compliance.log.slice(0, 10).map((e) => (
                    <li key={e.id} className="px-4 py-2.5 flex gap-3 text-sm">
                      <span className="text-pine/40 tabular-nums shrink-0">{new Date(e.at).toLocaleDateString()}</span>
                      <span className="text-pine/65">{e.summary}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* F4 — shareable savings report */}
        <section className="mt-10">
          <div className="rounded-2xl bg-cloud border border-pine/5 px-6 py-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Water savings report</h2>
              <p className="text-sm text-pine/55 mt-0.5">Gallons + dollars saved vs. a daily timer, per zone — branded and ready to save as PDF.</p>
            </div>
            <Link href="/report" className="rounded-full px-5 py-2.5 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition shrink-0">
              View report →
            </Link>
          </div>
        </section>

        {/* setup / restart onboarding */}
        <section className="mt-12 pt-8 border-t border-pine/5">
          <h2 className="text-base font-semibold text-pine/70">Setup</h2>
          <p className="mt-1 text-sm text-pine/55 max-w-xl">
            Changed controllers, re-zoned your yard, or want to start clean? Restart
            onboarding to re-detect your B-hyve devices and rebuild your lawn profile
            from scratch. Your account and plan stay intact.
          </p>
          <button
            onClick={() => setConfirmRestart(true)}
            className="mt-4 text-sm font-medium text-green hover:opacity-80 underline underline-offset-4"
          >
            Restart onboarding
          </button>
        </section>

        {/* subscription / cancel */}
        <section className="mt-12 pt-8 border-t border-pine/5">
          <h2 className="text-base font-semibold text-pine/70">Subscription</h2>
          <p className="mt-1 text-sm text-pine/55 max-w-xl">
            Canceling immediately stops any watering Verdyn is running and revokes our
            access to your B-hyve. Your controller and account stay yours.
          </p>
          <button
            onClick={() => setConfirmCancel(true)}
            className="mt-4 text-sm font-medium text-ember/80 hover:text-ember underline underline-offset-4"
          >
            Cancel subscription
          </button>
        </section>
      </div>

      {confirmRestart && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-pine/40 backdrop-blur-sm px-6">
          <div className="w-full max-w-md rounded-2xl bg-mist p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Restart onboarding?</h3>
            <p className="mt-2 text-sm text-pine/70">
              This clears your <strong>saved lawn profile, B-hyve connection, and run
              history</strong>, then takes you back through setup so you can re-detect
              your devices. Any watering Verdyn is running will be stopped. Your account
              and plan are kept.
            </p>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setConfirmRestart(false); setErr(null); }}
                disabled={restarting}
                className="rounded-full px-5 py-2.5 font-semibold text-pine border border-pine/15 hover:border-pine/30 transition disabled:opacity-50"
              >
                Keep my setup
              </button>
              <button
                onClick={restartOnboarding}
                disabled={restarting}
                className="rounded-full px-5 py-2.5 font-semibold text-cloud brand-gradient hover:opacity-90 transition disabled:opacity-50"
              >
                {restarting ? "Resetting…" : "Restart onboarding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-pine/40 backdrop-blur-sm px-6">
          <div className="w-full max-w-md rounded-2xl bg-mist p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Cancel your subscription?</h3>
            <p className="mt-2 text-sm text-pine/70">
              This will <strong>stop all watering Verdyn is running</strong> and revoke our
              access to your B-hyve so we can no longer program it. You can reactivate later by
              reconnecting your account.
            </p>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setConfirmCancel(false); setErr(null); }}
                disabled={canceling}
                className="rounded-full px-5 py-2.5 font-semibold text-pine border border-pine/15 hover:border-pine/30 transition disabled:opacity-50"
              >
                Keep Verdyn
              </button>
              <button
                onClick={cancelSubscription}
                disabled={canceling}
                className="rounded-full px-5 py-2.5 font-semibold text-cloud bg-ember hover:opacity-90 transition disabled:opacity-50"
              >
                {canceling ? "Canceling…" : "Cancel & turn off"}
              </button>
            </div>
          </div>
        </div>
      )}
      <DashStyles />
    </main>
  );
}

// F5 — explainability. Every plan shows its reasoning: the shared weather/
// restriction/season rationale, then each zone's own "why".
const FACTOR_ICON: Record<DecisionFactor["factor"], string> = {
  rain: "🌧️", wind: "💨", heat: "🔥", forecast: "🌦️", restriction: "📋",
  soil: "🪱", slope: "⛰️", plant: "🌱", season: "📅", establishment: "🌿", efficiency: "💧",
  recovery: "🩹", feedback: "👁️",
};

function WhyToday({ plan }: { plan: DailyPlan }) {
  const rationale = plan.rationale ?? [];
  const zonesWithWhy = plan.zoneOutcomes.filter((o) => (o.explanation?.length ?? 0) > 0);
  if (rationale.length === 0 && zonesWithWhy.length === 0 && plan.notes.length === 0) return null;

  return (
    <details className="border-t border-pine/5 bg-mist/50 group" open>
      <summary className="px-6 py-3.5 cursor-pointer list-none flex items-center justify-between select-none">
        <span className="text-sm font-semibold text-pine/70">Why today’s plan</span>
        <span className="text-xs text-pine/40 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="px-6 pb-5 space-y-4">
        {rationale.length > 0 && (
          <ul className="space-y-1.5">
            {rationale.map((f, i) => (
              <li key={i} className="text-sm text-pine/65 flex gap-2">
                <span aria-hidden>{FACTOR_ICON[f.factor]}</span><span>{f.text}</span>
              </li>
            ))}
          </ul>
        )}
        {zonesWithWhy.map((o) => (
          <ZoneWhy key={o.zoneId} outcome={o} />
        ))}
      </div>
    </details>
  );
}

function ZoneWhy({ outcome }: { outcome: ZoneOutcome }) {
  return (
    <div className="rounded-xl bg-cloud/70 border border-pine/5 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{outcome.zoneName}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${outcome.waters ? "bg-green/10 text-green" : "bg-rest/15 text-rest"}`}>
          {outcome.waters ? "Watering" : "Not today"}
        </span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {(outcome.explanation ?? []).map((f, i) => (
          <li key={i} className="text-sm text-pine/60 flex gap-2">
            <span aria-hidden>{FACTOR_ICON[f.factor]}</span><span>{f.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Signed-in account banner. A comp/owner account shows "unlimited"; every
// other hosted account is permanent (no billing), so the banner stays quiet.
function TrialBanner({ acct }: { acct: AccountState }) {
  if (acct.comped) {
    return (
      <div className="mt-6 rounded-xl bg-green/10 border border-green/20 px-4 py-3 flex items-center gap-3">
        <span aria-hidden className="text-lg">♾️</span>
        <p className="text-sm text-pine/75">
          <span className="font-semibold text-green">Owner account</span> — unlimited access, no billing. Verdyn keeps running.
        </p>
      </div>
    );
  }
  return null;
}

function PhaseBadge({ phase }: { phase: DailyPlan["phase"] }) {
  const map = {
    establishment: { c: "bg-tide/15 text-tide", l: "Establishment" },
    transition: { c: "bg-clay/15 text-clay", l: "Transition" },
    established: { c: "bg-green/10 text-green", l: "Established" },
  } as const;
  const m = map[phase];
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${m.c}`}>{m.l}</span>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen grid place-items-center px-6">{children}</main>;
}

function DashStyles() {
  return (
    <style>{`
      .btn-primary-link { background:linear-gradient(135deg,#0E7C5A,#8BE04A); color:#fff;
        font-weight:600; padding:0.7rem 1.4rem; border-radius:9999px; }
    `}</style>
  );
}

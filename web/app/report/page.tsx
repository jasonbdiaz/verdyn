"use client";

// F4 — rigorous, shareable savings proof. A branded, client-facing report:
// gallons + dollars saved vs. a clear dumb-timer baseline, broken out per zone,
// tied to a real or estimated local water rate, plus the property's compliance
// log. "Save as PDF" via the browser's print dialog (print CSS below) — no extra
// dependency, and the output is a clean one/two-page document a Pro can hand a
// client with their own name on it.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  brand, weeklyPreview, estimatePropertySavings, climateZoneForZip, policyForZip,
  type LawnProfile, type PropertySavingsReport, type ComplianceLogEntry,
} from "@verdyn/core";
import { Logo } from "@/components/Logo";
import { loadProfile } from "@/lib/profile";

const REPORT_DAYS = 30;

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
const fmtGal = (n: number) => n.toLocaleString("en-US");
const fmtUsd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ReportPage() {
  const [profile, setProfile] = useState<LawnProfile | null>(null);
  const [log, setLog] = useState<ComplianceLogEntry[]>([]);
  const [preparedFor, setPreparedFor] = useState("");
  const [rateOverride, setRateOverride] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setLoaded(true);
    if (!p) return;
    // Pull the compliance audit log to print alongside the savings.
    fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: p, addressLabel: `${p.zip} lawn` }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.log) setLog(j.log); })
      .catch(() => {});
  }, []);

  const state = profile?.localRestriction?.state ?? undefined;
  const report: PropertySavingsReport | null = useMemo(() => {
    if (!profile) return null;
    const from = isoDaysAgo(REPORT_DAYS - 1);
    const week = weeklyPreview(profile, from, REPORT_DAYS);
    const override = rateOverride ? Number(rateOverride) : undefined;
    return estimatePropertySavings(week, profile.zones, { state, ratePerKGalUsd: override });
  }, [profile, state, rateOverride]);

  if (loaded && !profile) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="text-center">
          <Logo />
          <p className="mt-6 text-pine/65">No lawn set up yet — nothing to report.</p>
          <Link href="/onboarding" className="inline-block mt-4 underline text-green">Start onboarding</Link>
        </div>
      </main>
    );
  }
  if (!profile || !report) return <main className="min-h-screen grid place-items-center"><p className="text-pine/50">Building report…</p></main>;

  const periodLabel = `${isoDaysAgo(REPORT_DAYS - 1)} → ${isoDaysAgo(0)}`;

  return (
    <main className="min-h-screen bg-mist">
      {/* toolbar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 border-b border-pine/10 bg-mist/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <Link href="/dashboard" className="text-sm font-medium text-pine/60 hover:text-green">← Dashboard</Link>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)}
              placeholder="Prepared for (client name)"
              className="rounded-lg border border-pine/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-green"
            />
            <input
              value={rateOverride} onChange={(e) => setRateOverride(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="$/1k gal"
              className="w-24 rounded-lg border border-pine/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-green"
              inputMode="decimal"
            />
            <button onClick={() => window.print()} className="rounded-full px-5 py-2 text-cloud font-semibold brand-gradient shadow-sm hover:opacity-90 transition">
              Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* the printable document */}
      <article className="mx-auto max-w-3xl bg-white my-6 print:my-0 shadow-sm print:shadow-none rounded-2xl print:rounded-none overflow-hidden">
        {/* header */}
        <header className="px-8 py-6 brand-gradient text-cloud flex items-center justify-between">
          <div>
            <p className="text-2xl font-extrabold tracking-tight">{brand.name}</p>
            <p className="text-cloud/85 text-sm">Water Savings Report</p>
          </div>
          <div className="text-right text-sm text-cloud/90">
            <p>{periodLabel}</p>
            <p>{report.days} days</p>
          </div>
        </header>

        <div className="px-8 py-6 space-y-7">
          {/* property line */}
          <section className="flex flex-wrap justify-between gap-2 text-sm text-pine/70">
            <div>
              {preparedFor && <p className="font-semibold text-pine text-base">Prepared for {preparedFor}</p>}
              <p>📍 {profile.zip} · {climateZoneForZip(profile.zip).label}</p>
              <p>📋 {policyForZip(profile.zip).label}</p>
            </div>
            <p className="text-pine/45">Generated {new Date().toLocaleDateString()}</p>
          </section>

          {/* headline numbers */}
          <section className="grid grid-cols-3 gap-4">
            <Stat label="Water saved" value={`${fmtGal(report.savedGal)} gal`} accent />
            <Stat label="Dollars saved" value={fmtUsd(report.savedUsd)} accent />
            <Stat label="Less than a daily timer" value={`${report.savedPct}%`} accent />
          </section>

          {/* baseline explanation */}
          <section className="rounded-xl bg-mist/70 border border-pine/5 px-5 py-4 text-sm text-pine/70">
            <p>
              Over {report.days} days, {brand.name} applied <strong>{fmtGal(report.appliedGal)} gal</strong> ({fmtUsd(report.appliedUsd)}),
              versus <strong>{fmtGal(report.baselineGal)} gal</strong> ({fmtUsd(report.baselineUsd)}) for a conventional
              timer running every zone {0.25}&quot; every day. Savings come from weather/ET skips, seasonal dial-down,
              and right-sizing each zone to what actually grows there.
            </p>
            <p className="mt-2 text-xs text-pine/45">
              Water rate: {fmtUsd(report.ratePerKGalUsd)}/1,000 gal
              {report.rateIsEstimate ? ` (estimated for ${state ?? "US average"} — enter the client's actual rate above for an exact figure)` : " (client rate)"}.
            </p>
          </section>

          {/* per-zone table */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-pine/50 mb-2">By zone</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-pine/50 border-b border-pine/10">
                  <th className="py-2 font-semibold">Zone</th>
                  <th className="py-2 font-semibold text-right">Applied</th>
                  <th className="py-2 font-semibold text-right">Baseline</th>
                  <th className="py-2 font-semibold text-right">Saved</th>
                  <th className="py-2 font-semibold text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {report.perZone.map((z) => (
                  <tr key={z.zoneId} className="border-b border-pine/5">
                    <td className="py-2 font-medium text-pine">{z.zoneName}</td>
                    <td className="py-2 text-right tabular-nums text-pine/70">{fmtGal(z.appliedGal)}</td>
                    <td className="py-2 text-right tabular-nums text-pine/70">{fmtGal(z.baselineGal)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-green">{fmtGal(z.savedGal)}</td>
                    <td className="py-2 text-right tabular-nums text-pine/70">{z.savedPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* compliance log */}
          {log.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-pine/50 mb-2">Compliance record</h2>
              <p className="text-xs text-pine/50 mb-2">
                Timestamped trail of the watering rules in force at this address and every change to them.
              </p>
              <ul className="space-y-1.5">
                {log.slice(0, 12).map((e) => (
                  <li key={e.id} className="text-sm text-pine/70 flex gap-3">
                    <span className="text-pine/40 tabular-nums shrink-0">{new Date(e.at).toLocaleDateString()}</span>
                    <span>{e.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* footer / legal */}
          <footer className="pt-4 border-t border-pine/5 text-[11px] text-pine/45 leading-relaxed">
            <p>
              Estimates model irrigated area and local rates; actual utility bills vary with pressure, coverage, and tariff structure.
              For metered verification, enter the client&apos;s billed rate above.
            </p>
            <p className="mt-1">{brand.legal}</p>
          </footer>
        </div>
      </article>

      <ReportStyles />
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-4 text-center ${accent ? "bg-green/5 border border-green/15" : "bg-mist border border-pine/5"}`}>
      <p className="text-2xl font-extrabold text-pine tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-pine/55">{label}</p>
    </div>
  );
}

function ReportStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body { background: #fff !important; }
        @page { margin: 0.6in; }
      }
    `}</style>
  );
}

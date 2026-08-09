"use client";

import { useMemo, useState } from "react";
import {
  GAL_PER_INCH_SQFT, BASELINE_DAILY_INCHES, waterRateForState, WATER_RATE_USD_PER_KGAL,
} from "@verdyn/core";

// Typical outdoor-water reduction from smart, weather/ET-based scheduling vs. a
// fixed daily timer. EPA WaterSense puts smart controllers around 30–50%; we use
// a conservative middle estimate and show it as "up to".
const SMART_SAVINGS_PCT = 0.45;

// States we surface in the picker (rate table lives in core).
const STATES = Object.keys(WATER_RATE_USD_PER_KGAL).sort();

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

export function SavingsCalculator() {
  const [sqft, setSqft] = useState(5000);
  const [state, setState] = useState("FL");

  const { savedGalYr, savedUsdYr, baselineGalYr } = useMemo(() => {
    // A daily timer applies 0.25"/day across the whole lawn, all year.
    const baselineGalYr = BASELINE_DAILY_INCHES * 365 * sqft * GAL_PER_INCH_SQFT;
    const savedGalYr = baselineGalYr * SMART_SAVINGS_PCT;
    const savedUsdYr = (savedGalYr / 1000) * waterRateForState(state);
    return { savedGalYr, savedUsdYr, baselineGalYr };
  }, [sqft, state]);

  return (
    <div className="rounded-3xl bg-cloud border border-pine/5 shadow-xl shadow-green/5 overflow-hidden">
      <div className="grid md:grid-cols-2">
        {/* inputs */}
        <div className="p-7 sm:p-9">
          <p className="text-sm font-semibold text-green">Water savings estimator</p>
          <h3 className="mt-1 text-2xl font-bold">See what you&apos;d save</h3>

          <label className="mt-7 block">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-pine/70">Lawn area</span>
              <span className="tabular-nums font-semibold text-pine">{fmtNum(sqft)} sq ft</span>
            </div>
            <input
              type="range" min={1000} max={20000} step={500}
              value={sqft} onChange={(e) => setSqft(Number(e.target.value))}
              className="mt-2 w-full accent-green"
              aria-label="Lawn area in square feet"
            />
            <div className="flex justify-between text-[11px] text-pine/40">
              <span>1k</span><span>20k sq ft</span>
            </div>
          </label>

          <label className="mt-6 block">
            <span className="block text-sm font-medium text-pine/70 mb-1.5">Your state</span>
            <select
              value={state} onChange={(e) => setState(e.target.value)}
              className="w-full rounded-xl border border-pine/12 bg-white px-3.5 py-2.5 outline-none focus:border-green"
            >
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <p className="mt-5 text-xs text-pine/45">
            Estimate vs. a fixed daily timer at local water rates. Real savings depend
            on soil, grass, and weather — Verdyn optimizes all three.
          </p>
        </div>

        {/* result */}
        <div className="bg-pine text-mist p-7 sm:p-9 flex flex-col justify-center">
          <p className="text-mist/60 text-sm">Estimated savings, per year</p>
          <p className="display mt-1 text-5xl sm:text-6xl font-bold text-sprout tabular-nums">
            {fmtUSD(savedUsdYr)}
          </p>
          <div className="mt-6 space-y-3">
            <Stat label="Water saved" value={`${fmtNum(savedGalYr)} gal`} />
            <Stat label="Less water used" value={`${Math.round(SMART_SAVINGS_PCT * 100)}%`} />
            <Stat label="Daily-timer baseline" value={`${fmtNum(baselineGalYr)} gal`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-mist/10 pt-3">
      <span className="text-mist/70 text-sm">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

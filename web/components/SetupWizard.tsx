"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GRASS_TYPES, SOIL_TYPES, PLANT_TYPES, PLANS,
  emptyProfile, defaultZone, plantById,
  climateZoneForZip, policyForZip,
  type LawnProfile, type ZoneProfile, type SoilTextureId,
  type SunExposure, type SlopeLevel, type ZonePlantTypeId,
  type LocalRestriction, type PlanTier, type ControllerBrandInfo,
} from "@verdyn/core";
import { saveProfile } from "@/lib/profile";
import { loadIntent, clearIntent, type SetupIntent } from "@/lib/setup-intent";
import { HeadPicker } from "@/components/HeadPicker";
import { LinkModal, type ConnectedZone } from "@/components/LinkModal";

// The authenticated "continue setup" wizard — runs AFTER the account exists.
// Connect the controller, configure zones, and answer property details, then
// land in the live dashboard. The pre-account choices (audience/system/expert)
// arrive via the persisted SetupIntent.
type SStep =
  | "controller_type" | "connect"
  | "zones_basics" | "zones_heads" | "zones_plants"
  | "property" | "expert_zone_detail" | "review";

const META: Record<SStep, { title: string; subtitle: string }> = {
  controller_type: {
    title: "What kind of device?",
    subtitle: "Pick everything you have — Verdyn will pull in the exact devices on your account.",
  },
  connect: {
    title: "Connect your controller",
    subtitle: "Link your B-hyve account. Bank-level encryption — we store a secure token, never your password.",
  },
  zones_basics: {
    title: "Your zones",
    subtitle: "We pulled these from your controller. For each zone, tell us roughly how many heads, and whether it's drip.",
  },
  zones_heads: {
    title: "Sprinkler type",
    subtitle: "Match each zone's sprinkler head to the picture — or scan one. This sets the runtime math.",
  },
  zones_plants: {
    title: "What grows in each zone?",
    subtitle: "Each zone gets its own water need, root depth, and cycle logic based on what's planted.",
  },
  property: {
    title: "A few property details",
    subtitle: "These set your climate, local watering rules, and soak rates.",
  },
  expert_zone_detail: {
    title: "Fine-tune each zone",
    subtitle: "Sun, slope, and optional measured precip let Verdyn nail cycle-and-soak.",
  },
  review: {
    title: "Here's your plan",
    subtitle: "This is what Verdyn will run. You can tweak anything, anytime.",
  },
};

export function SetupWizard() {
  const router = useRouter();

  // Pre-account choices, carried across the magic-link round-trip.
  const [intent, setIntent] = useState<SetupIntent>({ audience: "homeowner", system: "bhyve", expert: false });
  useEffect(() => { setIntent(loadIntent()); }, []);
  const { audience, system } = intent;
  const expert = intent.expert;
  const setExpert = (v: boolean) => setIntent((i) => ({ ...i, expert: v }));

  const [idx, setIdx] = useState(0);
  const [hasMain, setHasMain] = useState(false);
  const [hasHose, setHasHose] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedBrand, setConnectedBrand] = useState<string | null>(null);
  const [zones, setZones] = useState<ZoneProfile[]>([]);

  const [zip, setZip] = useState("");
  const [soil, setSoil] = useState<SoilTextureId>("loam");
  const [parity, setParity] = useState<"odd" | "even">("odd");
  const [isNew, setIsNew] = useState(false);
  const [sodDate, setSodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [building, setBuilding] = useState(false);

  const tier: PlanTier = expert ? "expert" : "weather";
  const [restriction, setRestriction] = useState<LocalRestriction | null>(null);
  const [restrictionLoading, setRestrictionLoading] = useState(false);
  const lookupKey = useRef("");

  // "Other system" users have nothing to connect — give them demo zones so the
  // rest of setup has something to configure.
  useEffect(() => {
    if (system === "others" && zones.length === 0) {
      setZones(demoZones().map((z) => defaultZone(z.name, z.station, z.deviceId)));
      setConnected(true);
      setConnectedBrand("demo");
    }
  }, [system]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zip.length !== 5) { setRestriction(null); return; }
    const key = `${zip}:${tier}`;
    if (key === lookupKey.current) return;
    lookupKey.current = key;
    let aborted = false;
    setRestrictionLoading(true);
    fetch("/api/restrictions/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip, tier }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!aborted) setRestriction(j?.restriction ?? null); })
      .catch(() => { if (!aborted) setRestriction(null); })
      .finally(() => { if (!aborted) setRestrictionLoading(false); });
    return () => { aborted = true; };
  }, [zip, tier]);

  const stepIds = useMemo<SStep[]>(() => {
    const s: SStep[] = [];
    if (system === "bhyve") s.push("controller_type", "connect");
    s.push("zones_basics", "zones_heads", "zones_plants", "property");
    if (expert) s.push("expert_zone_detail");
    s.push("review");
    return s;
  }, [system, expert]);

  const step = stepIds[Math.min(idx, stepIds.length - 1)];
  const pct = Math.round(((idx + 1) / stepIds.length) * 100);
  const next = () => setIdx((i) => Math.min(stepIds.length - 1, i + 1));
  const back = () => setIdx((i) => Math.max(0, i - 1));

  function adoptZones(connectedZones: ConnectedZone[]) {
    setZones(connectedZones.map((z) => defaultZone(z.name, z.station, z.deviceId)));
  }

  function setZoneCount(n: number) {
    const target = Math.max(1, Math.min(64, Math.floor(n)));
    setZones((zs) => {
      if (target === zs.length) return zs;
      if (target < zs.length) return zs.slice(0, target);
      const nextZones = [...zs];
      let station = zs.reduce((m, z) => Math.max(m, z.bhyveStation ?? 0), 0);
      while (nextZones.length < target) {
        station += 1;
        nextZones.push(defaultZone(`Zone ${station}`, station));
      }
      return nextZones;
    });
  }

  function onConnected(connectedZones: ConnectedZone[], brand: ControllerBrandInfo) {
    adoptZones(connectedZones.length ? connectedZones : demoZones());
    setConnected(true);
    setConnectedBrand(brand.name);
    setLinkOpen(false);
    next();
  }

  function useDemo() {
    adoptZones(demoZones());
    setConnected(true);
    setConnectedBrand("demo");
    setLinkOpen(false);
    const z = stepIds.indexOf("zones_basics");
    setIdx(z >= 0 ? z : idx + 1);
  }

  async function finish() {
    setBuilding(true);
    const profile: LawnProfile = {
      ...emptyProfile(),
      zip,
      climateZoneId: climateZoneForZip(zip).id,
      soilTextureId: soil,
      addressParity: parity,
      establishmentStart: isNew ? sodDate : null,
      expertMode: expert,
      tier,
      localRestriction: restriction,
      zones,
    };
    saveProfile(profile);
    clearIntent();
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* dashboard-style header: you're signed in, finishing setup */}
      <header className="border-b border-pine/5 bg-mist/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full brand-gradient text-cloud text-sm font-bold">V</span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-pine">Finish setting up</p>
              <p className="text-xs text-pine/45">You're signed in — let's get Verdyn running.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <span className={expert ? "text-pine/45" : "text-green"}>Basic</span>
            <button
              type="button"
              onClick={() => setExpert(!expert)}
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
          {step === "controller_type" && (
            <div className="space-y-3">
              <CheckRow
                checked={hasMain}
                onToggle={() => setHasMain((v) => !v)}
                icon="🎛️"
                label="Smart controller"
                note="A wall-mounted multi-zone box wired to in-ground sprinklers."
              />
              <CheckRow
                checked={hasHose}
                onToggle={() => setHasHose((v) => !v)}
                icon="🚰"
                label="Hose / faucet timer"
                note="A battery timer that screws onto an outdoor faucet."
              />
              <p className="text-xs text-pine/45">
                Not sure? Pick your best guess — after connecting, Verdyn shows the exact
                devices on your B-hyve account and you can adjust.
              </p>
            </div>
          )}

          {step === "connect" && (
            <div className="space-y-4">
              {connected ? (
                <Card className="border-green/30 bg-green/5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-green/15 text-lg text-green">✓</span>
                    <div>
                      <p className="font-semibold text-pine">
                        {connectedBrand === "demo" ? "Demo zones ready" : "Controller connected"}
                      </p>
                      <p className="text-sm text-pine/60">
                        {zones.length} zone{zones.length === 1 ? "" : "s"} detected — you&apos;ll set them up next.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setLinkOpen(true)} className="btn-ghost mt-3 px-0 text-sm">
                    Reconnect a different controller
                  </button>
                </Card>
              ) : (
                <Card>
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl brand-gradient text-xl text-cloud">🔌</span>
                    <div>
                      <p className="font-semibold text-pine">Connect your B-hyve</p>
                      <p className="mt-0.5 text-sm text-pine/60">
                        Securely link your Orbit account so Verdyn can read your zones and run
                        cycles. We store an encrypted token — never your password.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={() => setLinkOpen(true)} className="btn-primary">
                      <LockGlyph /> Connect securely
                    </button>
                    <button onClick={useDemo} className="btn-ghost">Try with demo zones</button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {step === "zones_basics" && (
            <div className="space-y-3">
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">How many zones?</p>
                    <p className="text-xs text-pine/55">One per valve/station. We pre-filled what we detected — adjust if needed.</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button type="button" onClick={() => setZoneCount(zones.length - 1)} disabled={zones.length <= 1} className="vstep" aria-label="Fewer zones">−</button>
                    <span className="tabular-nums font-semibold w-6 text-center">{zones.length}</span>
                    <button type="button" onClick={() => setZoneCount(zones.length + 1)} disabled={zones.length >= 64} className="vstep" aria-label="More zones">+</button>
                  </div>
                </div>
              </Card>
              {zones.map((z, i) => {
                const isDrip = z.headTypeId === "drip";
                return (
                  <Card key={z.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{z.name}</span>
                      <span className="text-xs text-pine/40">{z.bhyveStation ? `Station ${z.bhyveStation}` : `Zone ${i + 1}`}</span>
                    </div>
                    <div className="mt-3 grid sm:grid-cols-2 gap-3">
                      <Field label="How many sprinkler heads? (optional)">
                        <input type="number" min="0" max="200" inputMode="numeric" placeholder="e.g. 6"
                          className="vinput" value={z.headCount ?? ""}
                          onChange={(e) => updateZone(setZones, i, {
                            headCount: e.target.value ? Math.max(0, Math.floor(Number(e.target.value))) : undefined,
                          })} />
                      </Field>
                      <label className="flex items-end pb-1">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-pine/75 cursor-pointer">
                          <button
                            type="button"
                            onClick={() => updateZone(setZones, i, { headTypeId: isDrip ? "mp_rotator" : "drip" })}
                            aria-pressed={isDrip}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isDrip ? "bg-green" : "bg-pine/20"}`}
                          >
                            <span className={`inline-block transform rounded-full bg-cloud shadow transition ${isDrip ? "translate-x-5" : "translate-x-1"}`} style={{ height: "1.125rem", width: "1.125rem" }} />
                          </button>
                          This zone is drip / micro irrigation
                        </span>
                      </label>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {step === "zones_heads" && (
            <div className="space-y-3">
              {zones.map((z, i) => (
                <Card key={z.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{z.name}</span>
                    <span className="text-xs text-pine/40">{z.bhyveStation ? `Station ${z.bhyveStation}` : `Zone ${i + 1}`}</span>
                  </div>
                  {z.headTypeId === "drip" ? (
                    <p className="mt-3 rounded-xl bg-mist/60 border border-pine/10 px-4 py-3 text-sm text-pine/65">
                      💧 Drip / micro irrigation — slow, targeted watering. Nothing else to set here.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-pine/70 mb-1.5">Which sprinkler head? Match the picture — or scan yours.</p>
                      <HeadPicker compact value={z.headTypeId} onChange={(id) => updateZone(setZones, i, { headTypeId: id })} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {step === "zones_plants" && (
            <div className="space-y-3">
              {zones.map((z, i) => {
                const plant = plantById(z.plantTypeId);
                return (
                  <Card key={z.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{z.name}</span>
                      <span className="text-xs text-pine/40">{plant.name}</span>
                    </div>
                    <select
                      className="vinput mt-3"
                      value={z.plantTypeId ?? "lawn"}
                      onChange={(e) => updateZone(setZones, i, { plantTypeId: e.target.value as ZonePlantTypeId })}
                    >
                      {PLANT_TYPES.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-sm text-pine/55 mt-2">{plant.note}</p>
                    {plant.usesGrass && (
                      <select
                        className="vinput mt-3"
                        value={z.grassTypeId}
                        onChange={(e) => updateZone(setZones, i, { grassTypeId: e.target.value })}
                      >
                        {GRASS_TYPES.map((g) => (
                          <option key={g.id} value={g.id}>{g.name} — {g.season === "warm" ? "warm-season" : "cool-season"}</option>
                        ))}
                      </select>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {step === "property" && (
            <div className="space-y-3">
              <Card>
                <Field label="ZIP code">
                  <input inputMode="numeric" maxLength={5} value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                    className="vinput text-2xl tracking-widest" placeholder="33186" />
                </Field>
                {zip.length === 5 && (
                  <p className="text-sm text-pine/60 mt-2">
                    Climate: <strong className="text-pine">{climateZoneForZip(zip).label}</strong>
                  </p>
                )}
                {zip.length === 5 && (
                  <div className="mt-4 rounded-xl border border-pine/10 bg-mist/60 p-4">
                    {restrictionLoading ? (
                      <p className="text-sm text-pine/55">{expert ? "Researching your county's watering rules…" : "Checking local rules…"}</p>
                    ) : restriction ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-pine">
                            {restriction.county ? `${restriction.county}${restriction.state ? `, ${restriction.state}` : ""}` : restriction.label}
                          </span>
                          <SourceBadge source={restriction.source} />
                        </div>
                        <p className="mt-1.5 text-sm text-pine/65">{restriction.summary}</p>
                        {!expert && (
                          <p className="mt-2 text-xs text-pine/45">
                            Upgrade to <strong className="text-green">Expert</strong> for AI-researched rules specific to your county.
                          </p>
                        )}
                        {restriction.needsVerification && (
                          <p className="mt-2 text-xs text-clay">AI-sourced — please confirm against your local utility before relying on it.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-pine/55">Local rule: <strong className="text-pine">{policyForZip(zip).label}</strong></p>
                    )}
                  </div>
                )}
              </Card>

              <Card>
                <p className="font-semibold mb-3">What&apos;s your soil like?</p>
                <ChoiceGrid
                  options={SOIL_TYPES.map((s) => ({ value: s.id, label: s.name, note: s.note }))}
                  value={soil}
                  onChange={(v) => setSoil(v as SoilTextureId)}
                />
              </Card>

              <Card>
                <p className="font-semibold mb-3">Odd or even address?</p>
                <p className="text-sm text-pine/55 -mt-2 mb-3">Many cities assign watering days by address number — we&apos;ll match your allowed days.</p>
                <ChoiceGrid
                  options={[
                    { value: "odd", label: "Odd address", note: "Ends in 1, 3, 5, 7, 9" },
                    { value: "even", label: "Even address", note: "Ends in 0, 2, 4, 6, 8" },
                  ]}
                  value={parity}
                  onChange={(v) => setParity(v as "odd" | "even")}
                />
              </Card>

              <Card>
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">New sod or seed?</p>
                    <p className="text-sm text-pine/55">New lawns need daily light watering — and usually get a restriction exemption.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNew((v) => !v)}
                    aria-pressed={isNew}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${isNew ? "bg-green" : "bg-pine/20"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-cloud shadow transition ${isNew ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </label>
                {isNew && (
                  <Field label="When was it laid / seeded?" className="mt-4">
                    <input type="date" value={sodDate} onChange={(e) => setSodDate(e.target.value)} className="vinput" />
                  </Field>
                )}
              </Card>
            </div>
          )}

          {step === "expert_zone_detail" && (
            <div className="space-y-3">
              {zones.map((z, i) => (
                <Card key={z.id}>
                  <p className="font-semibold mb-3">{z.name}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Sun">
                      <select className="vinput" value={z.sun}
                        onChange={(e) => updateZone(setZones, i, { sun: e.target.value as SunExposure })}>
                        <option value="full_sun">Full sun</option>
                        <option value="partial">Partial</option>
                        <option value="shade">Shade</option>
                      </select>
                    </Field>
                    <Field label="Slope">
                      <select className="vinput" value={z.slope}
                        onChange={(e) => updateZone(setZones, i, { slope: e.target.value as SlopeLevel })}>
                        <option value="flat">Flat</option>
                        <option value="moderate">Moderate</option>
                        <option value="steep">Steep</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Measured precip rate (in/hr) — optional" className="mt-3">
                    <input type="number" step="0.05" min="0" placeholder="catch-cup test result"
                      className="vinput" value={z.measuredPrecipInHr ?? ""}
                      onChange={(e) => updateZone(setZones, i, {
                        measuredPrecipInHr: e.target.value ? Number(e.target.value) : undefined,
                      })} />
                  </Field>
                </Card>
              ))}
            </div>
          )}

          {step === "review" && (
            <Card>
              <ul className="divide-y divide-pine/5 text-sm">
                <Row k="For" v={audience === "business" ? "Lawn-care business" : "My own lawn"} />
                <Row k="System" v={system === "others" ? "Other (demo)" : "B-hyve from Orbit"} />
                {system === "bhyve" && <Row k="Devices" v={[hasMain ? "Controller" : null, hasHose ? "Hose timer" : null].filter(Boolean).join(" · ") || "—"} />}
                <Row k="Location" v={`${zip || "—"} · ${zip.length === 5 ? climateZoneForZip(zip).label : "—"}`} />
                <Row k="Local rule" v={restriction ? (restriction.county ? `${restriction.county} — ${restriction.label}` : restriction.label) : (zip.length === 5 ? policyForZip(zip).label : "—")} />
                <Row k="Soil" v={SOIL_TYPES.find((s) => s.id === soil)?.name ?? soil} />
                <Row k="Address" v={parity === "odd" ? "Odd" : "Even"} />
                <Row k="Lawn" v={isNew ? `New sod (since ${sodDate})` : "Established"} />
                <Row k="Plan" v={expert ? `Expert · ${PLANS.expert.priceLabel}` : `Weather · ${PLANS.weather.priceLabel}`} />
                <Row k="Zones" v={`${zones.length} · ${zones.map((z) => plantById(z.plantTypeId).usesGrass ? (GRASS_TYPES.find((g) => g.id === z.grassTypeId)?.name ?? "Lawn") : plantById(z.plantTypeId).name).join(", ")}`} />
                {zones.some((z) => z.headTypeId === "drip") && <Row k="Drip zones" v={`${zones.filter((z) => z.headTypeId === "drip").length}`} />}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-pine/5 bg-mist/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center justify-between">
          <button onClick={back} disabled={idx === 0} className="btn-ghost disabled:opacity-30">Back</button>
          {step === "review" ? (
            <button onClick={finish} disabled={building} className="btn-primary">
              {building ? "Building your plan…" : "Go to my dashboard →"}
            </button>
          ) : step === "connect" ? (
            connected
              ? <button onClick={next} className="btn-primary">Continue</button>
              : <span className="text-xs text-pine/40">Connect to continue</span>
          ) : (
            <button
              onClick={next}
              disabled={
                (step === "controller_type" && !hasMain && !hasHose) ||
                (step === "property" && zip.length !== 5) ||
                ((step === "zones_basics" || step === "zones_heads" || step === "zones_plants") && zones.length === 0)
              }
              className="btn-primary disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </footer>

      <LinkModal
        open={linkOpen}
        presetSlug={hasHose && !hasMain ? "bhyve-hose" : "bhyve"}
        onClose={() => setLinkOpen(false)}
        onConnected={onConnected}
        onDemo={useDemo}
      />

      <StyleHelpers />
    </main>
  );
}

// ── small helpers ───────────────────────────────────────────────

function demoZones(): ConnectedZone[] {
  return [
    { deviceId: "demo", station: 1, name: "Front Lawn" },
    { deviceId: "demo", station: 2, name: "Backyard" },
  ];
}

function updateZone(
  setZones: React.Dispatch<React.SetStateAction<ZoneProfile[]>>,
  i: number, patch: Partial<ZoneProfile>,
) {
  setZones((zs) => zs.map((z, j) => (j === i ? { ...z, ...patch } : z)));
}

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

function CheckRow({
  checked, onToggle, icon, label, note,
}: {
  checked: boolean; onToggle: () => void; icon: string; label: string; note: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${checked ? "border-green bg-green/5 ring-1 ring-green" : "border-pine/10 bg-cloud hover:border-green/40"}`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mist text-xl">{icon}</span>
      <span className="flex-1">
        <span className="font-semibold block">{label}</span>
        <span className="text-sm text-pine/55 block mt-0.5">{note}</span>
      </span>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${checked ? "border-green bg-green text-cloud" : "border-pine/20"}`}>
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

function LockGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="inline-block mr-1.5 -mt-0.5">
      <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" opacity="0.9" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SourceBadge({ source }: { source: LocalRestriction["source"] }) {
  const map = {
    ai: { t: "AI-researched", c: "bg-green/10 text-green" },
    cache: { t: "AI-researched", c: "bg-green/10 text-green" },
    builtin: { t: "Built-in", c: "bg-pine/10 text-pine/60" },
  } as const;
  const b = map[source];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.c}`}>{b.t}</span>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex justify-between gap-4 py-2.5">
      <span className="text-pine/55">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </li>
  );
}

function StyleHelpers() {
  return (
    <style>{`
      .vinput { width:100%; border:1px solid rgba(8,35,27,.12); border-radius:0.9rem;
        padding:0.7rem 0.9rem; background:#fff; outline:none; transition:border-color .15s; }
      .vinput:focus { border-color:#0E7C5A; box-shadow:0 0 0 3px rgba(14,124,90,.12); }
      .vstep { width:2.25rem; height:2.25rem; border-radius:9999px; border:1px solid rgba(8,35,27,.15);
        background:#fff; font-size:1.25rem; line-height:1; color:#08231B; transition:border-color .15s; }
      .vstep:hover:not(:disabled) { border-color:#0E7C5A; color:#0E7C5A; }
      .vstep:disabled { opacity:.35; cursor:not-allowed; }
      .btn-primary { background:linear-gradient(135deg,#0E7C5A,#8BE04A); color:#fff;
        font-weight:600; padding:0.7rem 1.4rem; border-radius:9999px; transition:opacity .15s; display:inline-flex; align-items:center; }
      .btn-primary:hover { opacity:.9; }
      .btn-primary:disabled { opacity:.4; cursor:not-allowed; }
      .btn-ghost { font-weight:600; color:#08231B; padding:0.7rem 1.2rem; border-radius:9999px; }
      .btn-ghost:hover { color:#0E7C5A; }
    `}</style>
  );
}

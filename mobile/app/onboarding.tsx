import { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GRASS_TYPES, SOIL_TYPES, HEAD_TYPES,
  emptyProfile, defaultZone, stepsFor,
  climateZoneForZip, policyForZip, bhyve,
  CONTROLLER_CATALOG, brandBySlug,
  type LawnProfile, type ZoneProfile, type SoilTextureId,
  type HeadTypeId, type SunExposure, type SlopeLevel,
  type ControllerBrandInfo, type ControllerStatus,
} from "@verdyn/core";
import { C, GRADIENT, radius, space } from "@/lib/theme";
import { saveProfile } from "@/lib/storage";
import { postWaitlist } from "@/lib/api";

type ConnZone = { deviceId: string; station: number; name: string };

export default function Onboarding() {
  const router = useRouter();
  const [expert, setExpert] = useState(false);
  const [idx, setIdx] = useState(0);

  const [zip, setZip] = useState("");
  const [soil, setSoil] = useState<SoilTextureId>("loam");
  const [parity, setParity] = useState<"odd" | "even">("odd");
  const [isNew, setIsNew] = useState(false);
  const [zones, setZones] = useState<ZoneProfile[]>([]);

  const [selectedBrand, setSelectedBrand] = useState("bhyve"); // the only live brand today
  const selectedBrandInfo = useMemo(() => brandBySlug(selectedBrand), [selectedBrand]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [building, setBuilding] = useState(false);

  const steps = useMemo(() => stepsFor(expert), [expert]);
  const step = steps[idx];
  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const next = () => setIdx((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setIdx((i) => Math.max(0, i - 1));

  const demo: ConnZone[] = [
    { deviceId: "demo", station: 1, name: "Front Lawn" },
    { deviceId: "demo", station: 2, name: "Backyard" },
  ];

  function adopt(cz: ConnZone[]) {
    setZones(cz.map((z) => defaultZone(z.name, z.station, z.deviceId)));
  }

  async function doConnect() {
    setConnecting(true);
    setConnectErr(null);
    try {
      // B-hyve client runs directly on-device; password mints a token only.
      const session = await bhyve.login(email, password);
      const devices = await bhyve.listDevices(session);
      const flat = devices.flatMap((d) =>
        d.zones.map((z) => ({ deviceId: d.id, station: z.station, name: z.name })),
      );
      adopt(flat.length ? flat : demo);
      setConnected(true);
      setPassword(""); // don't retain the password in memory past login
      next();
    } catch (e) {
      setConnectErr((e as Error).message || "Couldn't connect. Try again.");
    } finally {
      setConnecting(false);
    }
  }

  async function finish() {
    setBuilding(true);
    const profile: LawnProfile = {
      ...emptyProfile(),
      zip,
      climateZoneId: climateZoneForZip(zip).id,
      soilTextureId: soil,
      addressParity: parity,
      establishmentStart: isNew ? new Date().toISOString().slice(0, 10) : null,
      expertMode: expert,
      zones,
    };
    await saveProfile(profile);
    router.replace("/dashboard");
  }

  const continueDisabled =
    (step.id === "zip" && zip.length !== 5) || (step.id === "zones" && zones.length === 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.stepNo}>{`Step ${idx + 1} of ${steps.length}`}</Text>
        <View style={styles.modeRow}>
          <Text style={[styles.modeLabel, { color: expert ? "rgba(8,35,27,0.4)" : C.green }]}>Basic</Text>
          <Switch value={expert} onValueChange={setExpert} trackColor={{ true: C.green, false: "#cdd8d2" }} thumbColor={C.cloud} />
          <Text style={[styles.modeLabel, { color: expert ? C.green : "rgba(8,35,27,0.4)" }]}>Expert</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>

        {step.id === "intro" && (
          <Card>
            <Text style={styles.p}>
              Flip on <Text style={styles.b}>Expert mode</Text> to fine-tune sprinkler
              type, sun, and slope per zone. Otherwise Basic uses smart defaults.
            </Text>
          </Card>
        )}

        {step.id === "connect" && (
          <>
            <Text style={styles.pickerLabel}>Which controller do you have?</Text>
            <BrandPicker selected={selectedBrand} onSelect={setSelectedBrand} />

            {selectedBrandInfo?.status === "live" && (
              <Card>
                <Label>{`${selectedBrandInfo.name} email`}</Label>
                <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address"
                  value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9bb0a6" />
                <Label>{`${selectedBrandInfo.name} password`}</Label>
                <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor="#9bb0a6" />
                {connectErr && <Text style={styles.err}>{connectErr}</Text>}
                <Text style={styles.hint}>Your password mints a secure session token and is never stored.</Text>
                <PrimaryBtn label={connecting ? "Connecting…" : `Connect ${selectedBrandInfo.name}`} onPress={doConnect}
                  disabled={connecting || !email || !password} />
                {connecting && <ActivityIndicator color={C.green} style={{ marginTop: 8 }} />}
                <Pressable style={styles.ghostBtn} onPress={() => { adopt(demo); setConnected(true); next(); }}>
                  <Text style={styles.ghostText}>Try with demo zones</Text>
                </Pressable>
              </Card>
            )}

            {selectedBrandInfo && selectedBrandInfo.status !== "live" && (
              <>
                <NotifyMe key={selectedBrandInfo.slug} brand={selectedBrandInfo} />
                <Card>
                  <Text style={styles.p}>
                    Want to look around now? Explore Verdyn with demo zones — your lawn
                    plan still works, we just won&apos;t run a controller yet.
                  </Text>
                  <Pressable style={styles.ghostBtn} onPress={() => { adopt(demo); setConnected(true); next(); }}>
                    <Text style={styles.ghostText}>Try with demo zones</Text>
                  </Pressable>
                </Card>
              </>
            )}
          </>
        )}

        {step.id === "zip" && (
          <Card>
            <Label>ZIP code</Label>
            <TextInput style={[styles.input, styles.zip]} keyboardType="number-pad" maxLength={5}
              value={zip} onChangeText={(t) => setZip(t.replace(/[^0-9]/g, ""))} placeholder="33186" placeholderTextColor="#9bb0a6" />
            {zip.length === 5 && (
              <Text style={styles.hint}>
                {climateZoneForZip(zip).label} · {policyForZip(zip).label}
              </Text>
            )}
          </Card>
        )}

        {step.id === "soil" && (
          <Choices
            options={SOIL_TYPES.map((s) => ({ value: s.id, label: s.name, note: s.note }))}
            value={soil} onChange={(v) => setSoil(v as SoilTextureId)} />
        )}

        {step.id === "address_parity" && (
          <Choices
            options={[
              { value: "odd", label: "Odd address", note: "Ends in 1, 3, 5, 7, 9" },
              { value: "even", label: "Even address", note: "Ends in 0, 2, 4, 6, 8" },
            ]}
            value={parity} onChange={(v) => setParity(v as "odd" | "even")} />
        )}

        {step.id === "establishment" && (
          <Choices
            options={[
              { value: "no", label: "Established lawn", note: "Deep, infrequent, conservation-smart." },
              { value: "yes", label: "New sod or seed", note: "Daily light watering, then taper." },
            ]}
            value={isNew ? "yes" : "no"} onChange={(v) => setIsNew(v === "yes")} />
        )}

        {step.id === "zones" && zones.map((z, i) => (
          <Card key={z.id}>
            <Text style={styles.zoneName}>{z.name}</Text>
            <View style={styles.chipWrap}>
              {GRASS_TYPES.map((g) => (
                <Chip key={g.id} label={g.name} active={z.grassTypeId === g.id}
                  onPress={() => patchZone(setZones, i, { grassTypeId: g.id })} />
              ))}
            </View>
          </Card>
        ))}

        {step.id === "expert_zone_detail" && zones.map((z, i) => (
          <Card key={z.id}>
            <Text style={styles.zoneName}>{z.name}</Text>
            <Label>Sprinkler</Label>
            <View style={styles.chipWrap}>
              {HEAD_TYPES.map((h) => (
                <Chip key={h.id} label={h.name} active={z.headTypeId === h.id}
                  onPress={() => patchZone(setZones, i, { headTypeId: h.id as HeadTypeId })} />
              ))}
            </View>
            <Label>Sun</Label>
            <View style={styles.chipWrap}>
              {(["full_sun", "partial", "shade"] as SunExposure[]).map((s) => (
                <Chip key={s} label={s.replace("_", " ")} active={z.sun === s}
                  onPress={() => patchZone(setZones, i, { sun: s })} />
              ))}
            </View>
            <Label>Slope</Label>
            <View style={styles.chipWrap}>
              {(["flat", "moderate", "steep"] as SlopeLevel[]).map((s) => (
                <Chip key={s} label={s} active={z.slope === s}
                  onPress={() => patchZone(setZones, i, { slope: s })} />
              ))}
            </View>
          </Card>
        ))}

        {step.id === "review" && (
          <Card>
            <Row k="Location" v={`${zip} · ${zip.length === 5 ? climateZoneForZip(zip).label : "—"}`} />
            <Row k="Local rule" v={zip.length === 5 ? policyForZip(zip).label : "—"} />
            <Row k="Soil" v={SOIL_TYPES.find((s) => s.id === soil)?.name ?? soil} />
            <Row k="Address" v={parity === "odd" ? "Odd" : "Even"} />
            <Row k="Lawn" v={isNew ? "New sod" : "Established"} />
            <Row k="Mode" v={expert ? "Expert" : "Basic"} />
            <Row k="Zones" v={`${zones.length}`} last />
          </Card>
        )}
      </ScrollView>

      {/* footer */}
      <View style={styles.footer}>
        <Pressable onPress={back} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
          <Text style={styles.ghostText}>Back</Text>
        </Pressable>
        {step.id === "review" ? (
          <PrimaryBtn label={building ? "Building…" : "See my plan →"} onPress={finish} disabled={building} compact />
        ) : step.id === "connect" ? (
          <Text style={styles.hintRight}>{connected ? "Connected ✓" : "Connect to continue"}</Text>
        ) : (
          <PrimaryBtn label="Continue" onPress={next} disabled={continueDisabled} compact />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── components ───────────────────────────────────────────────────
function patchZone(set: React.Dispatch<React.SetStateAction<ZoneProfile[]>>, i: number, patch: Partial<ZoneProfile>) {
  set((zs) => zs.map((z, j) => (j === i ? { ...z, ...patch } : z)));
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function StatusPill({ status }: { status: ControllerStatus }) {
  const map = {
    live: { t: "Live", bg: "rgba(14,124,90,0.1)", fg: C.green },
    beta: { t: "Beta", bg: "rgba(232,161,58,0.15)", fg: C.clay },
    coming_soon: { t: "Soon", bg: "rgba(8,35,27,0.06)", fg: "rgba(8,35,27,0.5)" },
  } as const;
  const s = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.t}</Text>
    </View>
  );
}
function BrandPicker({ selected, onSelect }: { selected: string; onSelect: (slug: string) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      {CONTROLLER_CATALOG.map((b) => {
        const active = b.slug === selected;
        return (
          <Pressable key={b.slug} onPress={() => onSelect(b.slug)}
            style={[styles.brandRow, active && styles.choiceActive]}>
            <Text style={[styles.brandName, b.status !== "live" && { color: "rgba(8,35,27,0.7)" }]}>{b.name}</Text>
            <StatusPill status={b.status} />
          </Pressable>
        );
      })}
    </View>
  );
}
function NotifyMe({ brand }: { brand: ControllerBrandInfo }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function submit() {
    setState("sending");
    await postWaitlist(email, brand.slug); // fails soft — we acknowledge either way
    setState("done");
  }

  if (state === "done") {
    return (
      <Card>
        <Text style={styles.b}>You&apos;re on the list ✓</Text>
        <Text style={styles.p}>We&apos;ll email you the moment {brand.name} support goes live.</Text>
      </Card>
    );
  }
  return (
    <Card>
      <Text style={styles.b}>{brand.name} is coming soon</Text>
      <Text style={styles.p}>
        Verdyn doesn&apos;t run {brand.name} yet. Leave your email and we&apos;ll let you
        know the day it&apos;s ready.
      </Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9bb0a6" />
      <PrimaryBtn label={state === "sending" ? "Saving…" : "Notify me"} onPress={submit}
        disabled={state === "sending" || !email} />
    </Card>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function PrimaryBtn({ label, onPress, disabled, compact }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.4 : 1 }}>
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.primary, compact && styles.primaryCompact]}>
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
function Choices({ options, value, onChange }: { options: { value: string; label: string; note?: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)}
            style={[styles.choice, active && styles.choiceActive]}>
            <Text style={styles.choiceLabel}>{o.label}</Text>
            {o.note && <Text style={styles.choiceNote}>{o.note}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={[styles.kv, !last && styles.kvBorder]}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={styles.kvV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.sm },
  stepNo: { color: C.green, fontWeight: "700", fontSize: 13 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeLabel: { fontSize: 13, fontWeight: "600" },
  progressTrack: { height: 4, backgroundColor: "rgba(8,35,27,0.06)", marginTop: space.sm },
  progressFill: { height: 4 },
  scroll: { padding: space.lg, gap: space.md, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: C.pine, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22, color: "rgba(8,35,27,0.65)", marginTop: -6, marginBottom: space.sm },
  card: { backgroundColor: C.cloud, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: "rgba(8,35,27,0.05)", gap: space.sm },
  p: { fontSize: 15, lineHeight: 22, color: "rgba(8,35,27,0.7)" },
  b: { fontWeight: "700", color: C.pine },
  label: { fontSize: 13, fontWeight: "600", color: "rgba(8,35,27,0.7)", marginTop: space.xs },
  input: { borderWidth: 1, borderColor: "rgba(8,35,27,0.12)", borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.pine, backgroundColor: "#fff" },
  zip: { fontSize: 26, letterSpacing: 8, textAlign: "center" },
  err: { color: C.ember, fontSize: 13 },
  hint: { fontSize: 13, color: "rgba(8,35,27,0.55)" },
  hintRight: { fontSize: 13, color: "rgba(8,35,27,0.4)" },
  primary: { paddingVertical: 15, borderRadius: radius.pill, alignItems: "center", marginTop: space.sm },
  primaryCompact: { paddingVertical: 12, paddingHorizontal: 28, marginTop: 0 },
  primaryText: { color: C.cloud, fontSize: 16, fontWeight: "700" },
  ghostBtn: { paddingVertical: 12, alignItems: "center" },
  ghostText: { color: C.green, fontSize: 15, fontWeight: "600" },
  choice: { backgroundColor: C.cloud, borderWidth: 1, borderColor: "rgba(8,35,27,0.1)", borderRadius: radius.lg, padding: space.md },
  choiceActive: { borderColor: C.green, backgroundColor: "rgba(14,124,90,0.06)" },
  pickerLabel: { fontSize: 13, fontWeight: "600", color: "rgba(8,35,27,0.7)" },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.cloud, borderWidth: 1, borderColor: "rgba(8,35,27,0.1)", borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  brandName: { fontSize: 15, fontWeight: "600", color: C.pine, flexShrink: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
  choiceLabel: { fontSize: 16, fontWeight: "700", color: C.pine },
  choiceNote: { fontSize: 13, color: "rgba(8,35,27,0.55)", marginTop: 3 },
  zoneName: { fontSize: 16, fontWeight: "700", color: C.pine },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(8,35,27,0.12)", backgroundColor: "#fff" },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { fontSize: 13, color: C.pine, fontWeight: "600", textTransform: "capitalize" },
  chipTextActive: { color: C.cloud },
  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  kvBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(8,35,27,0.05)" },
  kvK: { color: "rgba(8,35,27,0.55)", fontSize: 14 },
  kvV: { color: C.pine, fontWeight: "600", fontSize: 14, flexShrink: 1, textAlign: "right" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: "rgba(8,35,27,0.05)" },
});

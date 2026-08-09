import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  buildDailyPlan, weeklyPreview, GRASS_TYPES, climateZoneForZip, policyForZip,
  type LawnProfile, type DailyPlan, type WeatherInput,
} from "@verdyn/core";
import { Wordmark } from "@/components/Brand";
import { C, radius, space, statusStyle, phaseStyle } from "@/lib/theme";
import { loadProfile } from "@/lib/storage";
import { weatherForZip } from "@/lib/weather";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<LawnProfile | null>(null);
  const [today, setToday] = useState<DailyPlan | null>(null);
  const [week, setWeek] = useState<DailyPlan[]>([]);
  const [weather, setWeather] = useState<WeatherInput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      if (!p) { setLoading(false); return; }
      setProfile(p);
      const w = await weatherForZip(p.zip);
      setWeather(w);
      const date = todayISO();
      setToday(buildDailyPlan(p, w, date));
      setWeek(weeklyPreview(p, date, 7));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={C.green} /><Text style={styles.muted}>Building today’s plan…</Text></SafeAreaView>;
  }
  if (!profile) {
    return (
      <SafeAreaView style={styles.center}>
        <Wordmark />
        <Text style={styles.muted}>No lawn set up yet.</Text>
        <Pressable onPress={() => router.replace("/onboarding")}><Text style={styles.link}>Start onboarding →</Text></Pressable>
      </SafeAreaView>
    );
  }

  const ss = today ? statusStyle[today.status] : statusStyle.rest;
  const ps = today ? phaseStyle[today.phase] : phaseStyle.established;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Wordmark size={18} />
        <Pressable onPress={() => router.push("/onboarding")}><Text style={styles.editLink}>Edit setup</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.loc}>
          📍 {profile.zip} · {climateZoneForZip(profile.zip).label}
        </Text>
        <Text style={styles.loc}>📋 {policyForZip(profile.zip).label}</Text>
        {weather && (
          <Text style={styles.loc}>
            🌤️ {Math.round(weather.forecastHighF)}°F · {weather.precipChancePct}% rain · {Math.round(weather.windMph)} mph
          </Text>
        )}

        {today && (
          <>
            <View style={styles.todayHead}>
              <Text style={styles.h1}>Today</Text>
              <Badge bg={ps.bg} fg={ps.fg} label={ps.label} />
            </View>

            <View style={styles.card}>
              <View style={[styles.statusBar, { backgroundColor: ss.bg }]}>
                <Text style={[styles.statusText, { color: ss.fg }]}>
                  {ss.label}
                  {today.multiplier !== 1 && today.cycles.length > 0 ? ` · ${Math.round(today.multiplier * 100)}% runtime` : ""}
                </Text>
              </View>

              {today.cycles.length > 0 ? (
                today.cycles.map((c, i) => (
                  <View key={i} style={[styles.cycle, i > 0 && styles.cycleBorder]}>
                    <View>
                      <Text style={styles.cycleZone}>{c.zoneName}</Text>
                      <Text style={styles.cycleType}>{c.cycleType.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.cycleMeta}>
                      <Text style={styles.cycleTime}>{c.time}</Text> · {c.minutes} min · {c.inches}"
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noRun}>{today.zoneOutcomes[0]?.reason ?? "No watering scheduled today."}</Text>
              )}

              {today.notes.length > 0 && (
                <View style={styles.notes}>
                  {today.notes.map((n, i) => <Text key={i} style={styles.note}>• {n}</Text>)}
                </View>
              )}
            </View>
          </>
        )}

        <Text style={[styles.h1, { marginTop: space.lg }]}>Next 7 days</Text>
        <Text style={styles.muted}>Base schedule — runs adjust to live weather each morning.</Text>
        {week.map((d) => {
          const wd = WEEKDAYS[new Date(d.date + "T00:00:00Z").getUTCDay()];
          const s = statusStyle[d.status];
          const mins = d.cycles.reduce((a, c) => a + c.minutes, 0);
          return (
            <View key={d.date} style={styles.weekRow}>
              <Text style={styles.weekDay}>{wd} <Text style={styles.weekDate}>{d.date.slice(5)}</Text></Text>
              <View style={styles.weekRight}>
                {mins > 0 && <Text style={styles.weekMins}>{mins} min</Text>}
                <Badge bg={s.bg} fg={s.fg} label={s.label} small />
              </View>
            </View>
          );
        })}

        <Text style={[styles.h1, { marginTop: space.lg }]}>Your zones</Text>
        {profile.zones.map((z) => (
          <View key={z.id} style={styles.zoneRow}>
            <Text style={styles.zoneName}>{z.name}</Text>
            <Text style={styles.muted}>
              {GRASS_TYPES.find((g) => g.id === z.grassTypeId)?.name}
              {profile.expertMode ? ` · ${z.sun.replace("_", " ")} · ${z.slope}` : ""}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({ bg, fg, label, small }: { bg: string; fg: string; label: string; small?: boolean }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: small ? 10 : 12, paddingVertical: small ? 4 : 5, borderRadius: radius.pill }}>
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 12 : 13 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: "rgba(8,35,27,0.05)" },
  editLink: { color: "rgba(8,35,27,0.6)", fontWeight: "600", fontSize: 14 },
  scroll: { padding: space.lg, gap: 6, paddingBottom: 40 },
  loc: { fontSize: 13, color: "rgba(8,35,27,0.6)" },
  todayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  h1: { fontSize: 22, fontWeight: "800", color: C.pine, letterSpacing: -0.5 },
  muted: { fontSize: 13, color: "rgba(8,35,27,0.5)", marginBottom: 6 },
  link: { color: C.green, fontWeight: "700", fontSize: 16 },
  card: { backgroundColor: C.cloud, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(8,35,27,0.05)", overflow: "hidden", marginTop: space.sm },
  statusBar: { paddingHorizontal: space.md, paddingVertical: 12 },
  statusText: { fontWeight: "700", fontSize: 15 },
  cycle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingVertical: 13 },
  cycleBorder: { borderTopWidth: 1, borderTopColor: "rgba(8,35,27,0.05)" },
  cycleZone: { fontWeight: "600", fontSize: 15, color: C.pine },
  cycleType: { fontSize: 10, color: "rgba(8,35,27,0.4)", letterSpacing: 0.5, marginTop: 2 },
  cycleMeta: { fontSize: 14, color: "rgba(8,35,27,0.55)" },
  cycleTime: { fontWeight: "700", color: C.pine },
  noRun: { padding: space.md, color: "rgba(8,35,27,0.6)", fontSize: 14 },
  notes: { padding: space.md, borderTopWidth: 1, borderTopColor: "rgba(8,35,27,0.05)", backgroundColor: "rgba(244,250,246,0.6)", gap: 3 },
  note: { fontSize: 13, color: "rgba(8,35,27,0.6)" },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.cloud, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(8,35,27,0.05)", paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  weekDay: { fontWeight: "700", color: C.pine, fontSize: 15 },
  weekDate: { color: "rgba(8,35,27,0.4)", fontWeight: "400", fontSize: 13 },
  weekRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  weekMins: { fontSize: 13, color: "rgba(8,35,27,0.55)" },
  zoneRow: { backgroundColor: C.cloud, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(8,35,27,0.05)", paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  zoneName: { fontWeight: "700", color: C.pine, fontSize: 15 },
});

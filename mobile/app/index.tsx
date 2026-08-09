import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { brand } from "@verdyn/core";
import { LogoMark, Wordmark } from "@/components/Brand";
import { C, GRADIENT, radius, space } from "@/lib/theme";
import { loadProfile } from "@/lib/storage";

export default function Welcome() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    loadProfile().then((p) => {
      setHasProfile(!!p);
      setChecking(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <LogoMark size={84} />
        <Text style={styles.title}>Water like a pro.</Text>
        <Text style={styles.sub}>{brand.oneLiner}</Text>
        <Text style={styles.body}>
          Verdyn turns the B-hyve you already own into a smart, agronomy-driven
          irrigation system — soil, season, weather, and local rules, all handled.
        </Text>
      </View>

      <View style={styles.actions}>
        {checking ? (
          <ActivityIndicator color={C.green} />
        ) : (
          <>
            <Pressable onPress={() => router.push("/onboarding")}>
              <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Text style={styles.primaryText}>
                  {hasProfile ? "Set up a new lawn" : "Make my B-hyve smarter"}
                </Text>
              </LinearGradient>
            </Pressable>
            {hasProfile && (
              <Pressable style={styles.ghost} onPress={() => router.push("/dashboard")}>
                <Text style={styles.ghostText}>Go to my dashboard →</Text>
              </Pressable>
            )}
          </>
        )}
        <View style={styles.brandRow}>
          <Wordmark size={16} color={C.pine} />
        </View>
        <Text style={styles.legal}>{brand.legal}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: space.lg, justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center", gap: space.md },
  title: { fontSize: 44, fontWeight: "800", color: C.green, letterSpacing: -1, marginTop: space.lg },
  sub: { fontSize: 18, fontWeight: "700", color: C.pine },
  body: { fontSize: 16, lineHeight: 24, color: "rgba(8,35,27,0.65)" },
  actions: { gap: space.md, paddingBottom: space.lg },
  primary: { paddingVertical: 16, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: C.cloud, fontSize: 17, fontWeight: "700" },
  ghost: { paddingVertical: 14, alignItems: "center" },
  ghostText: { color: C.green, fontSize: 16, fontWeight: "600" },
  brandRow: { alignItems: "center", marginTop: space.sm },
  legal: { fontSize: 11, color: "rgba(8,35,27,0.4)", textAlign: "center", lineHeight: 15 },
});

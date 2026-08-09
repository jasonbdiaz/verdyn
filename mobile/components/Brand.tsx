import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GRADIENT, C } from "@/lib/theme";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.mist, fontSize: size * 0.5, fontWeight: "800" }}>◆</Text>
    </LinearGradient>
  );
}

export function Wordmark({ size = 22, color = C.pine }: { size?: number; color?: string }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size * 1.3} />
      <Text style={[styles.word, { fontSize: size, color }]}>Verdyn</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontWeight: "800", letterSpacing: -0.5 },
});

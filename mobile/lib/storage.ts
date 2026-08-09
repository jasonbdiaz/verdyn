import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LawnProfile } from "@verdyn/core";

const KEY = "verdyn.profile";

export async function saveProfile(p: LawnProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export async function loadProfile(): Promise<LawnProfile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as LawnProfile) : null;
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Session storage for Supabase Auth. On iOS/Android the session (which contains
 * the refresh token) lives in the Keychain / Android Keystore via SecureStore.
 * SecureStore values are limited to ~2 KB, so long values are split into chunks.
 * On web (used for local testing) it falls back to localStorage.
 */
const CHUNK = 1800;
const keyFor = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
    const k = keyFor(key);
    const count = await SecureStore.getItemAsync(`${k}.n`);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return void globalThis.localStorage?.setItem(key, value);
    const k = keyFor(key);
    await this.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${k}.n`, String(n));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") return void globalThis.localStorage?.removeItem(key);
    const k = keyFor(key);
    const count = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in via Supabase OAuth in the system browser sheet (works on iOS and
 * Android without a native Google SDK). The redirect URL, hrrecruit://auth/callback,
 * must be in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export async function signInWithGoogle(): Promise<{ error?: string }> {
  const redirectTo = Linking.createURL("auth/callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) return { error: "Google sign-in couldn't start. Try again." };
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return {}; // cancelled: no message needed
  const code = new URL(result.url).searchParams.get("code");
  if (!code) return { error: "Google sign-in didn't complete. Try again." };
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  return exErr ? { error: "Google sign-in didn't complete. Try again." } : {};
}

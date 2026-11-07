import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { authMessage, loginSchema } from "@hr/shared";
import { AuthShell } from "@/components/auth-shell";
import { Banner, Button, LinkText, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/google";
import { colors } from "@/lib/theme";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  async function submit() {
    setError(undefined);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({}); setBusy("email");
    const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(null);
    if (!err) return; // the root Gate moves the user on
    if (err.code === "email_not_confirmed") router.push({ pathname: "/check-email", params: { email: parsed.data.email, unconfirmed: "1" } });
    else if (err.code === "invalid_credentials" || err.status === 400) setError("The email or password is incorrect.");
    else setError(authMessage(err));
  }

  async function google() {
    setError(undefined); setBusy("google");
    const r = await signInWithGoogle();
    setBusy(null);
    if (r.error) setError(r.error);
  }

  return (
    <AuthShell title="Sign in" showJourney>
      {error && <Banner tone="error">{error}</Banner>}
      {Platform.OS !== "web" && (
        <>
          <Button title="Continue with Google" variant="secondary" onPress={google} loading={busy === "google"} disabled={!!busy} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} /><Text style={s.muted}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>
        </>
      )}
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" textContentType="emailAddress" error={errors.email} returnKeyType="next" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
        textContentType="password" error={errors.password} returnKeyType="go" onSubmitEditing={submit} />
      <Text style={[s.muted, { marginTop: -6 }]}><LinkText onPress={() => router.push("/forgot-password")}>Forgot your password?</LinkText></Text>
      <Button title="Sign in" onPress={submit} loading={busy === "email"} disabled={!!busy} />
      <Text style={s.muted}>New here? <LinkText onPress={() => router.push("/register")}>Create an account</LinkText></Text>
    </AuthShell>
  );
}

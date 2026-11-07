import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { authMessage, registerSchema } from "@hr/shared";
import { AuthShell } from "@/components/auth-shell";
import { Banner, Button, LinkText, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { colors } from "@/lib/theme";

const RULES = [
  { test: (v: string) => v.length >= 8, label: "8 or more characters" },
  { test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v), label: "Upper and lowercase letters" },
  { test: (v: string) => /[0-9]/.test(v), label: "At least one number" },
];

export default function Register() {
  const router = useRouter();
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (t: string) => setV((x) => ({ ...x, [k]: t }));

  async function submit() {
    setError(undefined);
    const parsed = registerSchema.safeParse(v);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      setErrors(fe); return;
    }
    setErrors({}); setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: parsed.data.email, password: parsed.data.password,
      options: { data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName }, emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard` },
    });
    setBusy(false);
    if (err) return setError(authMessage(err));
    if (!data.session) router.replace({ pathname: "/check-email", params: { email: parsed.data.email } });
  }

  return (
    <AuthShell title="Create your account" subtitle={<>Already registered? <LinkText onPress={() => router.replace("/sign-in")}>Sign in</LinkText></>}>
      {error && <Banner tone="error">{error}</Banner>}
      <TextField label="First name" value={v.firstName} onChangeText={set("firstName")} autoComplete="given-name" textContentType="givenName" error={errors.firstName} />
      <TextField label="Last name" value={v.lastName} onChangeText={set("lastName")} autoComplete="family-name" textContentType="familyName" error={errors.lastName} />
      <TextField label="Email" value={v.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} hint="We'll send a link to confirm it's you." />
      <View style={{ gap: 8 }}>
        <TextField label="Password" value={v.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.password} />
        {RULES.map((r) => {
          const ok = r.test(v.password);
          return <Text key={r.label} style={{ fontSize: 13, color: ok ? colors.ok : colors.muted }} accessibilityLabel={`${r.label}, ${ok ? "met" : "not met"}`}>{ok ? "✓" : "•"}  {r.label}</Text>;
        })}
      </View>
      <TextField label="Confirm password" value={v.confirmPassword} onChangeText={set("confirmPassword")} secureTextEntry autoComplete="new-password" error={errors.confirmPassword} />
      <Button title="Create account" onPress={submit} loading={busy} />
      <Text style={s.muted}>
        By creating an account you agree that we process your details to manage your applications, as described in our{" "}
        <LinkText onPress={() => void Linking.openURL(`${env.siteUrl}/privacy`)}>privacy policy</LinkText>.
      </Text>
    </AuthShell>
  );
}

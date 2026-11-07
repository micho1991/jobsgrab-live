import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { authMessage, forgotPasswordSchema } from "@hr/shared";
import { AuthShell } from "@/components/auth-shell";
import { Banner, Button, LinkText, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";

/** The reset link opens the web app, where the new password is chosen. */
export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setBusy(true); setError(undefined);
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password` });
    setBusy(false);
    if (err && (err.status === 429 || err.code?.startsWith("over_"))) return setError(authMessage(err));
    setDone(`If an account exists for ${parsed.data.email}, we've sent a link to reset the password. It expires in 1 hour.`);
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter the email you registered with and we'll send you a link to choose a new password.">
      {done ? <Banner tone="success">{done}</Banner> : (
        <>
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={error} />
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
      <Text style={s.muted}><LinkText onPress={() => router.replace("/sign-in")}>Back to sign in</LinkText></Text>
    </AuthShell>
  );
}

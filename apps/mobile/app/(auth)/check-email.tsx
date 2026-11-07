import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authMessage } from "@hr/shared";
import { AuthShell } from "@/components/auth-shell";
import { Banner, Button, LinkText, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { colors, radius } from "@/lib/theme";

export default function CheckEmail() {
  const router = useRouter();
  const { email = "", unconfirmed } = useLocalSearchParams<{ email?: string; unconfirmed?: string }>();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard` } });
    setBusy(false);
    setMsg(error && (error.status === 429 || error.code?.startsWith("over_"))
      ? { tone: "error", text: authMessage(error) }
      : { tone: "success", text: `If ${email} has an unverified account, a new link is on its way.` });
  }

  return (
    <AuthShell title="Check your inbox" subtitle={<>We sent a confirmation link to <Text style={{ fontWeight: "600", color: colors.ink }}>{email}</Text>.</>}>
      {unconfirmed && <Banner>You need to confirm your email address before you can sign in.</Banner>}
      <Text style={s.body}>Open the link on this phone, then come back here and sign in.</Text>
      <View style={{ backgroundColor: colors.mist, borderRadius: radius.panel, padding: 16, gap: 10 }}>
        <Text style={[s.body, { fontWeight: "600", color: colors.ink }]}>Didn&apos;t get it?</Text>
        <Text style={s.muted}>Check your spam folder. The link expires after 24 hours.</Text>
        {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
        {!!email && <Button title="Send a new link" variant="secondary" onPress={resend} loading={busy} />}
      </View>
      <Text style={s.muted}>Confirmed already? <LinkText onPress={() => router.replace("/sign-in")}>Sign in</LinkText></Text>
    </AuthShell>
  );
}

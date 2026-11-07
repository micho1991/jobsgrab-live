import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { friendlyError, isHrRole, profileSchema } from "@hr/shared";
import { Banner, Body, Button, Card, Checkbox, Muted, Screen, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { fmtDate } from "@/lib/format";

export function AccountScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [v, setV] = useState({ firstName: "", lastName: "", phone: "", address: "", city: "", country: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    setV({ firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone ?? "", address: profile.address ?? "", city: profile.city ?? "", country: profile.country ?? "" });
    void supabase.from("deletion_requests").select("requested_at").eq("user_id", profile.id).eq("status", "pending").maybeSingle()
      .then(({ data }) => setPending(data?.requested_at ?? null));
  }, [profile]));
  if (!profile) return null;
  const set = (k: keyof typeof v) => (t: string) => setV((x) => ({ ...x, [k]: t }));

  async function save() {
    const parsed = profileSchema.safeParse(v);
    if (!parsed.success) {
      const fe: Record<string, string> = {}; for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      return setErrors(fe);
    }
    setErrors({}); setBusy("save");
    const p = parsed.data;
    const { error } = await supabase.from("profiles").update({
      first_name: p.firstName, last_name: p.lastName, phone: p.phone || null, address: p.address || null, city: p.city || null, country: p.country || null,
    }).eq("id", profile!.id);
    setBusy(null);
    setMsg(error ? { tone: "error", text: friendlyError(error) } : { tone: "success", text: "Profile saved." });
    if (!error) void refreshProfile();
  }

  async function requestDeletion() {
    setBusy("delete");
    const { error } = await supabase.rpc("request_account_deletion", { p_reason: null });
    setBusy(null);
    if (error) return setMsg({ tone: "error", text: friendlyError(error) });
    setPending(new Date().toISOString()); setConfirmDelete(false);
  }

  return (
    <Screen>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <Card title="Personal details">
        <View style={{ padding: 16, gap: 14 }}>
          <TextField label="First name" value={v.firstName} onChangeText={set("firstName")} error={errors.firstName} />
          <TextField label="Last name" value={v.lastName} onChangeText={set("lastName")} error={errors.lastName} />
          {!isHrRole(profile.role) && (
            <>
              <TextField label="Phone number" optional value={v.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
              <TextField label="Address" optional value={v.address} onChangeText={set("address")} error={errors.address} />
              <TextField label="City" optional value={v.city} onChangeText={set("city")} error={errors.city} />
              <TextField label="Country" optional value={v.country} onChangeText={set("country")} error={errors.country} />
            </>
          )}
          <Button title="Save profile" onPress={() => void save()} loading={busy === "save"} />
        </View>
      </Card>

      <Card title="Sign-in">
        <View style={{ padding: 16, gap: 10 }}>
          <Muted>Email</Muted><Body style={{ marginTop: -6 }}>{profile.email}</Body>
          <Muted>To change your email or password, use your account page on the website.</Muted>
          <Button title="Open account settings" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${env.siteUrl}/account`)} />
        </View>
      </Card>

      {!isHrRole(profile.role) && (
        <Card title="Delete your data">
          <View style={{ padding: 16, gap: 12 }}>
            {pending ? <Banner>We received your deletion request on {fmtDate(pending)}. We&apos;ll delete your data within 30 days and email you when it&apos;s done.</Banner> : (
              <>
                <Muted>Ask us to permanently erase your account, applications and uploaded documents.</Muted>
                <Checkbox checked={confirmDelete} onChange={setConfirmDelete} label="I understand this permanently deletes my account and withdraws any open applications." />
                <Button title="Request deletion" variant="danger" disabled={!confirmDelete} loading={busy === "delete"} onPress={() => void requestDeletion()} />
              </>
            )}
          </View>
        </Card>
      )}

      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Text style={[s.muted, { textAlign: "center", fontSize: 12 }]}>{env.companyName} Careers</Text>
    </Screen>
  );
}

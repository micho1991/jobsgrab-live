import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Card, Empty, Muted, Row, Screen, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { colors } from "@/lib/theme";

interface Note { id: string; title: string; body: string; application_id: string | null; read_at: string | null; created_at: string }

export default function Updates() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<Note[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("id, title, body, application_id, read_at, created_at")
      .order("created_at", { ascending: false }).limit(50);
    setItems((data ?? []) as Note[]);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // New updates appear instantly while this screen is open.
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`updates-${session.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [session, load]);

  const unread = items?.filter((n) => !n.read_at).length ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Card title={unread ? `${unread} new` : "Updates"} right={unread > 0 ? (
        <Button title="Mark all as read" variant="ghost" small loading={busy} onPress={async () => {
          setBusy(true); await supabase.rpc("mark_notifications_read", { p_ids: null }); await load(); setBusy(false);
        }} />
      ) : undefined}>
        {items?.length === 0 && <Empty title="No updates yet" body="Status changes and interview invitations will appear here." />}
        {items?.map((n) => (
          <Row key={n.id} onPress={n.application_id ? () => router.push(`/application/${n.application_id}`) : undefined}
            accessibilityLabel={`${n.read_at ? "" : "Unread. "}${n.title}. ${n.body}`}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: n.read_at ? "transparent" : colors.ink }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.body, { fontWeight: "600", color: colors.ink }]}>{n.title}</Text>
                <Muted>{n.body}</Muted>
                <Muted style={{ fontSize: 12 }}>{fmtDateTime(n.created_at)}</Muted>
              </View>
            </View>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

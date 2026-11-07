import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { ApplicationStatus } from "@hr/shared";
import { Button, Card, Empty, Muted, Row, Screen, StatusBadge, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fmtDate, positionTitle } from "@/lib/format";

interface App { id: string; reference: string; status: ApplicationStatus; submitted_at: string; other_position: string | null; positions: { title: string } | null }

export default function Applications() {
  const router = useRouter();
  const { profile } = useAuth();
  const [apps, setApps] = useState<App[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("applications").select("id, reference, status, submitted_at, other_position, positions(title)")
      .order("submitted_at", { ascending: false });
    setApps((data ?? []) as unknown as App[]);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Text style={s.h2} accessibilityRole="header">Welcome{profile?.first_name ? `, ${profile.first_name}` : ""}</Text>
      <Card title="Your applications">
        {apps?.length === 0 && (
          <Empty title="You haven't applied for anything yet" body="Pick a role from the open positions, or send an open application."
            action={<Button title="See open positions" variant="secondary" onPress={() => router.push("/(candidate)")} />} />
        )}
        {apps?.map((a) => (
          <Row key={a.id} onPress={() => router.push(`/application/${a.id}`)} accessibilityLabel={`${positionTitle(a)}, ${a.status.replace(/_/g, " ")}`}>
            <View style={{ gap: 6 }}>
              <Text style={[s.body, { fontWeight: "600", color: "#0E2A47" }]}>{positionTitle(a)}</Text>
              <Muted>{a.reference}, submitted {fmtDate(a.submitted_at)}</Muted>
              <StatusBadge status={a.status} />
            </View>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

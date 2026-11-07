import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@hr/shared";
import { Banner, Card, Loading, Muted, Row, Screen, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

interface Stats {
  total_candidates: number; total_applications: number; new_applications: number; new_last_7_days: number;
  by_status: Partial<Record<ApplicationStatus, number>>; upcoming_interviews: number; pending_deletion_requests: number;
}

export default function HrOverview() {
  const router = useRouter();
  const { profile } = useAuth();
  const [st, setSt] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("hr_overview_stats");
    setError(!!e); setSt(data as Stats | null);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!st && !error) return <Loading />;

  const tile = (label: string, value: number, note?: string) => (
    <View key={label} style={{ width: "50%", padding: 14, borderColor: colors.line, borderRightWidth: 1, borderBottomWidth: 1, backgroundColor: colors.white }}>
      <Muted>{label}</Muted>
      <Text style={{ fontSize: 26, fontWeight: "700", color: colors.ink, marginTop: 2 }}>{value}</Text>
      {note && <Muted style={{ fontSize: 12 }}>{note}</Muted>}
    </View>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Text style={s.h2} accessibilityRole="header">Hello, {profile?.first_name || "there"}</Text>
      {error && <Banner tone="error">Statistics couldn&apos;t be loaded. Pull down to try again.</Banner>}
      {st && (
        <>
          <Card><View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -1, marginBottom: -1 }}>
            {tile("Candidates", st.total_candidates)}
            {tile("Applications", st.total_applications, `${st.new_last_7_days} this week`)}
            {tile("New", st.new_applications, "Not yet reviewed")}
            {tile("Upcoming interviews", st.upcoming_interviews)}
          </View></Card>
          <Card title="By stage">
            {APPLICATION_STATUSES.map((k) => (
              <Row key={k} onPress={() => router.push({ pathname: "/hr/applications", params: { status: k } })} accessibilityLabel={`${STATUS_META[k].label}, ${st.by_status[k] ?? 0}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={s.body}>{STATUS_META[k].label}</Text>
                  <Text style={[s.body, { fontWeight: "700", color: colors.ink }]}>{st.by_status[k] ?? 0}</Text>
                </View>
              </Row>
            ))}
          </Card>
          {st.pending_deletion_requests > 0 && profile?.role === "hr_admin" && (
            <Banner>{st.pending_deletion_requests} data deletion {st.pending_deletion_requests === 1 ? "request needs" : "requests need"} review on the web dashboard.</Banner>
          )}
          <Muted style={{ textAlign: "center" }}>Positions, the team and privacy requests are managed on the web dashboard.</Muted>
        </>
      )}
    </Screen>
  );
}

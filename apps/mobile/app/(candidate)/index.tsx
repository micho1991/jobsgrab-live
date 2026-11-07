import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@hr/shared";
import { Body, Button, Card, Empty, Muted, Screen, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import { colors } from "@/lib/theme";

interface Position {
  id: string; title: string; department: string | null; location: string | null;
  employment_type: EmploymentType; description: string; application_deadline: string | null;
}

export default function Jobs() {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data, error: e }, { data: apps }] = await Promise.all([
      supabase.from("positions").select("id, title, department, location, employment_type, description, application_deadline")
        .eq("is_active", true).eq("status", "open").or(`application_deadline.is.null,application_deadline.gte.${today}`)
        .order("created_at", { ascending: false }),
      supabase.from("applications").select("id, position_id").not("position_id", "is", null),
    ]);
    setError(!!e);
    setPositions((data ?? []) as Position[]);
    setApplied(Object.fromEntries(((apps ?? []) as { id: string; position_id: string }[]).map((a) => [a.position_id, a.id])));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {error && <Muted>Positions couldn&apos;t be loaded. Pull down to try again.</Muted>}
      {positions && <Muted>{positions.length} {positions.length === 1 ? "position" : "positions"} open</Muted>}
      <Card>
        {positions?.length === 0 && <Empty title="No open positions right now" body="You can still send an open application." />}
        {positions?.map((p, i) => {
          const expanded = open === p.id;
          const appId = applied[p.id];
          return (
            <View key={p.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.line } : undefined}>
              <Pressable onPress={() => setOpen(expanded ? null : p.id)} accessibilityRole="button" aria-expanded={expanded}
                style={({ pressed }) => [{ padding: 16, gap: 4 }, pressed && { backgroundColor: colors.mist }]}>
                <Text style={[s.h3]}>{p.title}</Text>
                <Muted>{[p.department, p.location, EMPLOYMENT_TYPES[p.employment_type]].filter(Boolean).join("   ")}</Muted>
                {p.application_deadline && <Text style={{ fontSize: 14, color: colors.ink }}>Apply by {fmtDate(p.application_deadline)}</Text>}
              </Pressable>
              {expanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
                  {!!p.description && <Body>{p.description}</Body>}
                  {appId
                    ? <Button title="View your application" variant="secondary" onPress={() => router.push(`/application/${appId}`)} />
                    : <Button title="Apply for this position" onPress={() => router.push(`/apply/${p.id}`)} />}
                </View>
              )}
            </View>
          );
        })}
      </Card>
      <Card style={{ padding: 16, gap: 10 }}>
        <Text style={s.h3}>Don&apos;t see the right role?</Text>
        <Muted>Send an open application and tell us what you&apos;re looking for.</Muted>
        <Button title="Send an open application" variant="secondary" onPress={() => router.push("/apply/other")} />
      </Card>
    </Screen>
  );
}

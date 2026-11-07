import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@hr/shared";
import { Button, Chip, Empty, Muted, StatusBadge, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Pressable } from "react-native";

interface Row { id: string; status: ApplicationStatus; submitted_at: string; first_name: string; last_name: string; email: string; other_position: string | null; positions: { title: string } | null }
const PAGE = 30;

export default function HrApplications() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState<ApplicationStatus | "">((params.status as ApplicationStatus) ?? "");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (params.status !== undefined) setStatus((params.status as ApplicationStatus) ?? ""); }, [params.status]);

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    let query = supabase.from("applications").select("id, status, submitted_at, first_name, last_name, email, other_position, positions(title)", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (term) query = query.ilike("search_text", `%${term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const { data, count } = await query.order("submitted_at", { ascending: false }).range(offset, offset + PAGE - 1);
    setRows((prev) => (offset ? [...prev, ...((data ?? []) as unknown as Row[])] : ((data ?? []) as unknown as Row[])));
    setTotal(count ?? 0); setLoading(false);
  }, [status, term]);
  useFocusEffect(useCallback(() => { void load(0); }, [load]));

  return (
    <FlatList
      style={{ backgroundColor: colors.mist }}
      data={rows}
      keyExtractor={(r) => r.id}
      onRefresh={() => void load(0)} refreshing={loading && rows.length === 0}
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 12 }}>
          <TextField label="Search" value={q} onChangeText={setQ} placeholder="Name or email" autoCapitalize="none"
            returnKeyType="search" onSubmitEditing={() => setTerm(q.trim())} onBlur={() => setTerm(q.trim())} />
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={["", ...APPLICATION_STATUSES] as const}
            keyExtractor={(k) => k || "all"} contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => <Chip label={item ? STATUS_META[item].label : "All"} selected={status === item} onPress={() => setStatus(item)} />} />
          <Muted>{total} {total === 1 ? "application" : "applications"}</Muted>
        </View>
      }
      ListEmptyComponent={loading ? undefined : <Empty title="No applications match" body="Try a different search or stage." />}
      renderItem={({ item: r }) => (
        <Pressable onPress={() => router.push(`/hr-application/${r.id}`)} accessibilityRole="button" accessibilityLabel={`${r.first_name} ${r.last_name}, ${STATUS_META[r.status].label}`}
          style={({ pressed }) => [{ backgroundColor: pressed ? colors.mist : colors.white, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line, gap: 4 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[s.body, { fontWeight: "600", color: colors.ink, flex: 1 }]} numberOfLines={1}>{r.first_name} {r.last_name}</Text>
            <StatusBadge status={r.status} />
          </View>
          <Muted numberOfLines={1}>{r.positions?.title ?? (r.other_position ? `Other: ${r.other_position}` : "")}</Muted>
          <Muted style={{ fontSize: 12 }}>{r.email}, {fmtDate(r.submitted_at)}</Muted>
        </Pressable>
      )}
      ListFooterComponent={rows.length < total ? <View style={{ padding: 16 }}><Button title="Load more" variant="secondary" loading={loading} onPress={() => void load(rows.length)} /></View> : <View style={{ height: 24 }} />}
    />
  );
}

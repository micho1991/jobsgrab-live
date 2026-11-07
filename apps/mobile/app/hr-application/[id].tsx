import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  APPLICATION_STATUSES, DOCUMENT_KIND_LABEL, STATUS_META, canManageApplications, formatBytes, friendlyError, noteSchema,
  type ApplicationStatus, type DocumentKind,
} from "@hr/shared";
import { Banner, Body, Button, Card, Empty, Loading, Muted, Screen, StatusBadge, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { openDocument } from "@/lib/files";
import { fmtDate, fmtDateTime, fmtLongDateTime, positionTitle } from "@/lib/format";
import { colors, radius } from "@/lib/theme";

interface App {
  id: string; reference: string; status: ApplicationStatus; submitted_at: string; first_name: string; last_name: string;
  email: string; phone: string; address: string; city: string; country: string; additional_info: string | null;
  other_position: string | null; positions: { title: string } | null;
}
interface Doc { id: string; kind: DocumentKind; file_name: string; size_bytes: number; storage_path: string; replaced_at: string | null }
interface Note { id: string; body: string; created_at: string; author_id: string | null; author: { first_name: string; last_name: string } | null }
interface Hist { id: number; from_status: ApplicationStatus | null; to_status: ApplicationStatus; created_at: string; actor: { first_name: string; last_name: string } | null }
interface Iv { id: string; scheduled_at: string; mode: string; cancelled_at: string | null }

export default function HrApplication() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, session } = useAuth();
  const canWrite = canManageApplications(profile?.role);
  const [d, setD] = useState<{ app: App; docs: Doc[]; notes: Note[]; hist: Hist[]; ivs: Iv[] } | null | "missing">(null);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: app }, { data: docs }, { data: notes }, { data: hist }, { data: ivs }] = await Promise.all([
      supabase.from("applications").select("id, reference, status, submitted_at, first_name, last_name, email, phone, address, city, country, additional_info, other_position, positions(title)").eq("id", id).maybeSingle(),
      supabase.from("documents").select("id, kind, file_name, size_bytes, storage_path, replaced_at").eq("application_id", id).order("created_at"),
      supabase.from("application_notes").select("id, body, created_at, author_id, author:profiles(first_name, last_name)").eq("application_id", id).order("created_at", { ascending: false }),
      supabase.from("application_status_history").select("id, from_status, to_status, created_at, actor:profiles(first_name, last_name)").eq("application_id", id).order("created_at", { ascending: false }),
      supabase.from("interviews").select("id, scheduled_at, mode, cancelled_at").eq("application_id", id).order("scheduled_at", { ascending: false }),
    ]);
    if (!app) return setD("missing");
    setD({ app: app as unknown as App, docs: (docs ?? []) as Doc[], notes: (notes ?? []) as unknown as Note[], hist: (hist ?? []) as unknown as Hist[], ivs: (ivs ?? []) as Iv[] });
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (d === null) return <Loading />;
  if (d === "missing") return <Screen><Empty title="Application not found" /></Screen>;
  const { app, docs, notes, hist, ivs } = d;

  async function changeStage(to: ApplicationStatus) {
    setPicking(false);
    if (to === app.status) return;
    setBusy("stage"); setMsg(null);
    const { data, error } = await supabase.from("applications").update({ status: to }).eq("id", app.id).select("id");
    setBusy(null);
    if (error || !data?.length) return setMsg({ tone: "error", text: error ? friendlyError(error) : "You don't have permission to do that." });
    setMsg({ tone: "success", text: `Moved to ${STATUS_META[to].label}. ${app.first_name} has been emailed.` });
    await load();
  }

  async function addNote() {
    const parsed = noteSchema.safeParse({ body: note });
    if (!parsed.success || !session) return;
    setBusy("note");
    const { error } = await supabase.from("application_notes").insert({ application_id: app.id, author_id: session.user.id, body: parsed.data.body });
    setBusy(null);
    if (error) return setMsg({ tone: "error", text: friendlyError(error) });
    setNote(""); await load();
  }

  async function open(doc: Doc) {
    // Every HR document access is audited, as on the web dashboard.
    const r = await openDocument(doc.storage_path, doc.file_name,
      async () => !(await supabase.rpc("log_document_access", { p_document_id: doc.id })).error);
    if (r.error) setMsg({ tone: "error", text: r.error });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `${app.first_name} ${app.last_name}` }} />
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <View style={{ gap: 6 }}>
        <Text style={s.h2} accessibilityRole="header">{app.first_name} {app.last_name}</Text>
        <Muted>{positionTitle(app)}, {app.reference}, submitted {fmtDate(app.submitted_at)}</Muted>
        <StatusBadge status={app.status} />
      </View>

      {canWrite && (
        <Card title="Stage">
          <View style={{ padding: 16, gap: 10 }}>
            <Button title={busy === "stage" ? "Updating…" : `Change stage (now ${STATUS_META[app.status].label})`} variant="secondary"
              loading={busy === "stage"} onPress={() => setPicking((p) => !p)} aria-expanded={picking} />
            {picking && (
              <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, overflow: "hidden" }} accessibilityRole="radiogroup">
                {APPLICATION_STATUSES.map((st, i) => (
                  <Pressable key={st} onPress={() => void changeStage(st)} accessibilityRole="radio" aria-checked={st === app.status}
                    style={({ pressed }) => [{ padding: 14, flexDirection: "row", justifyContent: "space-between", backgroundColor: pressed ? colors.mist : colors.white }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                    <Text style={{ fontSize: 16, color: colors.body, fontWeight: st === app.status ? "700" : "400" }}>{STATUS_META[st].label}</Text>
                    {st === app.status && <Text style={{ color: colors.ink }}>Current</Text>}
                  </Pressable>
                ))}
              </View>
            )}
            <Muted style={{ fontSize: 13 }}>{app.first_name} gets an email and an in-app update when the stage changes.</Muted>
          </View>
        </Card>
      )}

      <Card title="Contact">
        <View style={{ padding: 16, gap: 10 }}>
          <Pressable onPress={() => void Linking.openURL(`mailto:${app.email}`)} accessibilityRole="link"><Text style={s.link}>{app.email}</Text></Pressable>
          <Pressable onPress={() => void Linking.openURL(`tel:${app.phone.replace(/[^+\d]/g, "")}`)} accessibilityRole="link"><Text style={s.link}>{app.phone}</Text></Pressable>
          <Body>{app.address}, {app.city}, {app.country}</Body>
          <Muted>Anything else they want us to know</Muted>
          <Body style={{ marginTop: -6 }}>{app.additional_info || "Nothing added"}</Body>
        </View>
      </Card>

      <Card title="Documents">
        {docs.map((doc) => (
          <Pressable key={doc.id} onPress={() => void open(doc)} accessibilityRole="button" accessibilityLabel={`Open ${doc.file_name}`}
            style={({ pressed }) => [{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: pressed ? colors.mist : colors.white }]}>
            <Muted style={{ fontSize: 12 }}>{DOCUMENT_KIND_LABEL[doc.kind]}{doc.replaced_at ? `, replaced ${fmtDate(doc.replaced_at)}` : ""}</Muted>
            <Text style={[s.body, { fontWeight: "600", color: doc.replaced_at ? colors.muted : colors.ink }]} numberOfLines={1}>{doc.file_name}</Text>
            <Muted style={{ fontSize: 12 }}>{formatBytes(doc.size_bytes)}</Muted>
          </Pressable>
        ))}
        <Muted style={{ padding: 16, fontSize: 12, borderTopWidth: 1, borderTopColor: colors.line }}>Opening a document is logged for data protection.</Muted>
      </Card>

      <Card title="Internal notes">
        <View style={{ padding: 16, gap: 12 }}>
          <Muted style={{ fontSize: 13 }}>Internal to the HR team. Candidates never see these notes.</Muted>
          {canWrite && (
            <>
              <TextField label="Add a note" multiline value={note} onChangeText={setNote} maxLength={5000} placeholder="Add a note for the team" />
              <Button title="Add note" small disabled={!note.trim()} loading={busy === "note"} onPress={() => void addNote()} />
            </>
          )}
          {notes.length === 0 ? <Muted>No notes yet.</Muted> : notes.map((n) => (
            <View key={n.id} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, padding: 12, gap: 4 }}>
              <Muted style={{ fontSize: 12 }}>{n.author ? `${n.author.first_name} ${n.author.last_name}` : "Former team member"}, {fmtDateTime(n.created_at)}</Muted>
              <Body>{n.body}</Body>
            </View>
          ))}
        </View>
      </Card>

      {ivs.length > 0 && (
        <Card title="Interviews">
          <View style={{ padding: 16, gap: 8 }}>
            {ivs.map((iv) => <Body key={iv.id} style={iv.cancelled_at ? { textDecorationLine: "line-through", color: colors.muted } : undefined}>{fmtLongDateTime(iv.scheduled_at)}</Body>)}
            <Muted style={{ fontSize: 13 }}>Schedule or cancel interviews on the web dashboard.</Muted>
          </View>
        </Card>
      )}

      <Card title="History">
        <View style={{ padding: 16, gap: 12 }}>
          {hist.map((h) => (
            <View key={h.id}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>{h.from_status ? `${STATUS_META[h.from_status].label} to ${STATUS_META[h.to_status].label}` : "Application submitted"}</Text>
              <Muted style={{ fontSize: 12 }}>{fmtDateTime(h.created_at)}{h.actor && h.from_status ? `, by ${h.actor.first_name} ${h.actor.last_name}` : ""}</Muted>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  DOCUMENT_KIND_LABEL, MAX_ADDITIONAL_DOCUMENTS, PROGRESS_STEPS, STATUS_META, formatBytes, friendlyError, isTerminalStatus,
  type ApplicationStatus, type DocumentKind,
} from "@hr/shared";
import { Banner, Body, Button, Card, Empty, Loading, Muted, Screen, StatusBadge, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { discardUpload, openDocument, pickAndUpload } from "@/lib/files";
import { fmtDate, fmtDateTime, fmtLongDateTime, positionTitle } from "@/lib/format";
import { colors } from "@/lib/theme";

interface Detail {
  id: string; reference: string; status: ApplicationStatus; submitted_at: string; other_position: string | null;
  positions: { title: string } | null; first_name: string; last_name: string; email: string; phone: string;
  address: string; city: string; country: string; additional_info: string | null;
}
interface Doc { id: string; kind: DocumentKind; file_name: string; size_bytes: number; storage_path: string; created_at: string }
interface Hist { to_status: ApplicationStatus; created_at: string }
interface Iv { id: string; scheduled_at: string; duration_minutes: number; mode: "in_person" | "video" | "phone"; location: string | null; meeting_url: string | null; details_for_candidate: string | null; cancelled_at: string | null }
const MODE = { in_person: "In person", video: "Video call", phone: "Phone call" } as const;

export default function ApplicationScreen() {
  const { id, submitted } = useLocalSearchParams<{ id: string; submitted?: string }>();
  const { session } = useAuth();
  const [d, setD] = useState<{ app: Detail; docs: Doc[]; hist: Hist[]; ivs: Iv[] } | null | "missing">(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(submitted ? { tone: "success", text: "Your application has been submitted. We've emailed you a confirmation." } : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: app }, { data: docs }, { data: hist }, { data: ivs }] = await Promise.all([
      supabase.from("applications").select("id, reference, status, submitted_at, other_position, positions(title), first_name, last_name, email, phone, address, city, country, additional_info").eq("id", id).maybeSingle(),
      supabase.from("documents").select("id, kind, file_name, size_bytes, storage_path, created_at").eq("application_id", id).is("replaced_at", null).order("created_at"),
      supabase.from("application_status_history").select("to_status, created_at").eq("application_id", id).order("created_at"),
      supabase.from("interviews").select("id, scheduled_at, duration_minutes, mode, location, meeting_url, details_for_candidate, cancelled_at").eq("application_id", id).order("scheduled_at"),
    ]);
    if (!app) return setD("missing");
    setD({ app: app as unknown as Detail, docs: (docs ?? []) as Doc[], hist: (hist ?? []) as Hist[], ivs: (ivs ?? []) as Iv[] });
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (d === null) return <Loading />;
  if (d === "missing") return <Screen><Empty title="Application not found" /></Screen>;
  const { app, docs, hist, ivs } = d;
  const locked = isTerminalStatus(app.status);
  const rejected = app.status === "rejected";
  const reached = rejected ? ([...hist].reverse().find((h) => h.to_status !== "rejected")?.to_status ?? "submitted") : app.status;
  const current = STATUS_META[reached].step ?? 1;
  const upcoming = ivs.filter((i) => !i.cancelled_at && new Date(i.scheduled_at) > new Date());

  async function upload(kind: DocumentKind) {
    if (!session) return;
    setBusy(kind); setMsg(null);
    const up = await pickAndUpload(session.user.id);
    if (!up.file) { setBusy(null); if (up.error) setMsg({ tone: "error", text: up.error }); return; }
    const { error } = await supabase.rpc("add_or_replace_document", { p_application_id: app.id, p_kind: kind, p_storage_path: up.file.path, p_file_name: up.file.name });
    setBusy(null);
    if (error) { await discardUpload(up.file.path); return setMsg({ tone: "error", text: friendlyError(error) }); }
    setMsg({ tone: "success", text: kind === "other" ? `${up.file.name} was added.` : `Your ${DOCUMENT_KIND_LABEL[kind].toLowerCase()} was replaced with ${up.file.name}.` });
    await load();
  }

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Stack.Screen options={{ title: positionTitle(app) }} />
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
      <View style={{ gap: 6 }}>
        <Text style={s.h2} accessibilityRole="header">{positionTitle(app)}</Text>
        <Muted>Reference {app.reference}, submitted {fmtDate(app.submitted_at)}</Muted>
        <StatusBadge status={app.status} />
      </View>

      <Card title="Progress">
        <View style={{ padding: 16 }}>
          {PROGRESS_STEPS.map((st, i) => {
            const n = i + 1;
            const done = n < current || (n === current && st === "hired");
            const isCurrent = n === current && !rejected && st !== "hired";
            const date = n <= current ? hist.find((h) => h.to_status === st)?.created_at : undefined;
            return (
              <View key={st} style={{ flexDirection: "row", gap: 12 }} accessible
                accessibilityLabel={`${STATUS_META[st].label}${done ? ", completed" : isCurrent ? ", current stage" : ""}`}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5,
                    borderColor: n <= current ? colors.ink : colors.line, backgroundColor: done ? colors.ink : colors.white }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: done ? colors.white : n <= current ? colors.ink : colors.muted }}>{done ? "✓" : n}</Text>
                  </View>
                  {i < PROGRESS_STEPS.length - 1 && <View style={{ width: 1.5, flex: 1, minHeight: 14, backgroundColor: n < current ? colors.ink : colors.line }} />}
                </View>
                <View style={{ paddingBottom: 12, paddingTop: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: n <= current ? "600" : "400", color: n <= current ? colors.ink : colors.muted }}>{STATUS_META[st].label}</Text>
                  {date && <Muted style={{ fontSize: 12 }}>{fmtDate(date)}</Muted>}
                </View>
              </View>
            );
          })}
          <Muted style={{ marginTop: 4 }}>{STATUS_META[app.status].candidateHint}</Muted>
        </View>
      </Card>

      {upcoming.map((iv) => (
        <Card key={iv.id} title="Your interview" style={{ borderColor: "#C9D7E8", backgroundColor: colors.infoBg }}>
          <View style={{ padding: 16, gap: 8 }}>
            <Body style={{ fontWeight: "600", color: colors.ink }}>{fmtLongDateTime(iv.scheduled_at)}</Body>
            <Muted>{MODE[iv.mode]}, {iv.duration_minutes} minutes{iv.location ? `, ${iv.location}` : ""}</Muted>
            {iv.details_for_candidate && <Body>{iv.details_for_candidate}</Body>}
            {iv.meeting_url && <Button title="Open meeting link" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(iv.meeting_url!)} />}
          </View>
        </Card>
      ))}

      <Card title="Documents">
        {docs.map((doc) => (
          <View key={doc.id} style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Muted style={{ fontSize: 12 }}>{DOCUMENT_KIND_LABEL[doc.kind]}</Muted>
              <Text style={[s.body, { fontWeight: "600", color: colors.ink }]} numberOfLines={1}>{doc.file_name}</Text>
              <Muted style={{ fontSize: 12 }}>{formatBytes(doc.size_bytes)}, uploaded {fmtDate(doc.created_at)}</Muted>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button small title="Open" variant="secondary" accessibilityLabel={`Open ${doc.file_name}`} onPress={async () => {
                const r = await openDocument(doc.storage_path, doc.file_name); if (r.error) setMsg({ tone: "error", text: r.error });
              }} />
              {!locked && doc.kind !== "other" && <Button small title="Replace" variant="ghost" loading={busy === doc.kind} disabled={!!busy} onPress={() => void upload(doc.kind)} />}
            </View>
          </View>
        ))}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 }}>
          {locked ? <Muted>Documents can&apos;t be changed once a decision has been made.</Muted>
            : docs.filter((x) => x.kind === "other").length < MAX_ADDITIONAL_DOCUMENTS && (
              <>
                <Button title="Add a document" variant="secondary" loading={busy === "other"} disabled={!!busy} onPress={() => void upload("other")} />
                <Muted style={{ fontSize: 13 }}>Certificates, references or a portfolio. PDF, DOC or DOCX, up to 10 MB.</Muted>
              </>
            )}
        </View>
      </Card>

      <Card title="History">
        <View style={{ padding: 16, gap: 12 }}>
          {[...hist].reverse().map((h) => (
            <View key={`${h.to_status}${h.created_at}`}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>{h.to_status === "submitted" ? "Application submitted" : `Moved to ${STATUS_META[h.to_status].label}`}</Text>
              <Muted style={{ fontSize: 12 }}>{fmtDateTime(h.created_at)}</Muted>
            </View>
          ))}
          {ivs.filter((i) => i.cancelled_at).map((i) => (
            <View key={i.id}><Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>Interview on {fmtDate(i.scheduled_at)} cancelled</Text></View>
          ))}
        </View>
      </Card>

      <Card title="What you submitted">
        <View style={{ padding: 16, gap: 10 }}>
          <Muted>Name</Muted><Body style={{ marginTop: -8 }}>{app.first_name} {app.last_name}</Body>
          <Muted>Contact</Muted><Body style={{ marginTop: -8 }}>{app.email}, {app.phone}</Body>
          <Muted>Address</Muted><Body style={{ marginTop: -8 }}>{app.address}, {app.city}, {app.country}</Body>
          <Muted>Additional information</Muted><Body style={{ marginTop: -8 }}>{app.additional_info || "None"}</Body>
        </View>
      </Card>
    </Screen>
  );
}

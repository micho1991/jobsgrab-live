import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  EMPLOYMENT_TYPES, MAX_ADDITIONAL_DOCUMENTS, OTHER_POSITION, PRIVACY_POLICY_VERSION, applicationSchema, formatBytes, friendlyError,
  type EmploymentType,
} from "@hr/shared";
import { Banner, Body, Button, Card, Checkbox, LinkText, Loading, Muted, TextField, s } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { discardUpload, pickAndUpload, type UploadedFile } from "@/lib/files";
import { fmtDate } from "@/lib/format";
import { env } from "@/lib/env";
import { colors, radius } from "@/lib/theme";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";

const STEPS = ["Position", "Your details", "Documents", "About you", "Review"];
const TITLES = ["Position", "Personal details", "Documents", "Additional information", "Review and submit"];
const STEP_FIELDS = [["positionId", "otherPosition"], ["firstName", "lastName", "email", "phone", "address", "city", "country"], ["cv", "cover_letter"], ["additionalInfo"], ["consentAccuracy", "consentPrivacy"]];

interface Position { id: string; title: string; department: string | null; location: string | null; employment_type: EmploymentType; application_deadline: string | null }
type Docs = { cv: UploadedFile | null; cover_letter: UploadedFile | null; other: UploadedFile[] };

export default function Apply() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [v, setV] = useState({
    positionId: id ?? "", otherPosition: "", firstName: profile?.first_name ?? "", lastName: profile?.last_name ?? "",
    email: profile?.email ?? "", phone: profile?.phone ?? "", address: profile?.address ?? "", city: profile?.city ?? "",
    country: profile?.country ?? "", additionalInfo: "", consentAccuracy: false, consentPrivacy: false,
  });
  const [docs, setDocs] = useState<Docs>({ cv: null, cover_letter: null, other: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [saveProfile, setSaveProfile] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    void Promise.all([
      supabase.from("positions").select("id, title, department, location, employment_type, application_deadline")
        .eq("is_active", true).eq("status", "open").or(`application_deadline.is.null,application_deadline.gte.${today}`).order("title"),
      supabase.from("applications").select("position_id").not("position_id", "is", null),
    ]).then(([{ data }, { data: a }]) => {
      setPositions((data ?? []) as Position[]);
      setApplied(((a ?? []) as { position_id: string }[]).map((x) => x.position_id));
    });
  }, []);

  if (!positions) return <Loading />;
  const set = (k: keyof typeof v) => (val: string | boolean) => { setV((x) => ({ ...x, [k]: val })); setErrors((e) => { const { [k]: _, ...r } = e; return r; }); };
  const selected = positions.find((p) => p.id === v.positionId);
  const unavailable = v.positionId && v.positionId !== OTHER_POSITION && (!selected || applied.includes(v.positionId));

  function validate(i: number) {
    const out: Record<string, string> = {};
    const final = i === STEPS.length - 1;
    const parsed = applicationSchema.safeParse(final ? v : { ...v, consentAccuracy: true, consentPrivacy: true });
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]); if (STEP_FIELDS[i]!.includes(k)) out[k] ??= issue.message;
    }
    if (i === 0 && unavailable) out.positionId = "This position isn't available. Choose another.";
    if (i === 2 && !docs.cv) out.cv = "Upload your CV to continue";
    if (i === 2 && !docs.cover_letter) out.cover_letter = "Upload a cover letter to continue";
    return out;
  }
  const go = (n: number) => { setStep(n); setFormError(undefined); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const next = () => { const e = validate(step); setErrors(e); if (!Object.keys(e).length) go(step + 1); };

  async function upload(kind: keyof Docs) {
    if (!session) return;
    if (kind === "other" && docs.other.length >= MAX_ADDITIONAL_DOCUMENTS) return setErrors((e) => ({ ...e, other: `You can attach up to ${MAX_ADDITIONAL_DOCUMENTS} additional documents.` }));
    setBusy(kind); setErrors((e) => { const { [kind]: _, ...r } = e; return r; });
    const r = await pickAndUpload(session.user.id);
    setBusy(null);
    if (r.error) return setErrors((e) => ({ ...e, [kind]: r.error! }));
    if (r.file) setDocs((d) => kind === "other" ? { ...d, other: [...d.other, r.file!] } : { ...d, [kind]: r.file! });
  }
  function remove(kind: keyof Docs, i = 0) {
    const f = kind === "other" ? docs.other[i] : docs[kind];
    if (f) void discardUpload(f.path);
    setDocs((d) => kind === "other" ? { ...d, other: d.other.filter((_, j) => j !== i) } : { ...d, [kind]: null });
  }

  async function submit() {
    const e = validate(STEPS.length - 1); setErrors(e); if (Object.keys(e).length) return;
    const parsed = applicationSchema.parse(v);
    const isOther = parsed.positionId === OTHER_POSITION;
    const documents = [
      { kind: "cv", storage_path: docs.cv!.path, file_name: docs.cv!.name },
      { kind: "cover_letter", storage_path: docs.cover_letter!.path, file_name: docs.cover_letter!.name },
      ...docs.other.map((f) => ({ kind: "other", storage_path: f.path, file_name: f.name })),
    ];
    setBusy("submit"); setFormError(undefined);
    const { data, error } = await supabase.rpc("submit_application", {
      p_position_id: isOther ? null : parsed.positionId, p_other_position: isOther ? parsed.otherPosition ?? null : null,
      p_first_name: parsed.firstName, p_last_name: parsed.lastName, p_email: parsed.email, p_phone: parsed.phone,
      p_address: parsed.address, p_city: parsed.city, p_country: parsed.country, p_additional_info: parsed.additionalInfo || null,
      p_consent_accuracy: true, p_consent_privacy: true, p_documents: documents, p_privacy_policy_version: PRIVACY_POLICY_VERSION,
    });
    if (error || !data) { setBusy(null); return setFormError(friendlyError(error)); }
    if (saveProfile && session) {
      await supabase.from("profiles").update({ first_name: parsed.firstName, last_name: parsed.lastName, phone: parsed.phone, address: parsed.address, city: parsed.city, country: parsed.country }).eq("id", session.user.id);
      void refreshProfile();
    }
    setBusy(null);
    router.replace({ pathname: "/application/[id]", params: { id: (data as { id: string }).id, submitted: "1" } });
  }

  const fileRow = (f: UploadedFile, onRemove: () => void) => (
    <View key={f.path} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, padding: 12, backgroundColor: colors.white }}>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }} numberOfLines={1}>{f.name}</Text><Muted style={{ fontSize: 12 }}>{formatBytes(f.size)}, uploaded</Muted></View>
      <Button small title="Remove" variant="ghost" accessibilityLabel={`Remove ${f.name}`} onPress={onRemove} />
    </View>
  );
  const slot = (kind: keyof Docs, label: string, required: boolean) => {
    const files = kind === "other" ? docs.other : docs[kind] ? [docs[kind] as UploadedFile] : [];
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={s.label}>{label}</Text>{!required && <Muted style={{ fontSize: 12 }}>Optional</Muted>}</View>
        {files.map((f, i) => fileRow(f, () => remove(kind, i)))}
        {(kind === "other" || files.length === 0) && (
          <Button title={files.length ? "Add another file" : "Choose a file"} variant="secondary" loading={busy === kind} disabled={!!busy} onPress={() => void upload(kind)} />
        )}
        {errors[kind] ? <Text style={s.error}>{errors[kind]}</Text> : <Muted style={{ fontSize: 13 }}>PDF, DOC or DOCX, up to 10 MB</Muted>}
      </View>
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.mist }}>
      <Stack.Screen options={{ title: selected ? selected.title : "Apply" }} />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View accessible accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${TITLES[step]}`}>
          <Muted>Step {step + 1} of {STEPS.length}</Muted>
          <Text style={[s.h2, { marginTop: 2 }]} accessibilityRole="header">{TITLES[step]}</Text>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.ink, width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </View>
        </View>
        {formError && <Banner tone="error">{formError}</Banner>}

        <Card style={{ padding: 16, gap: 16 }}>
          {step === 0 && (
            <>
              <Text style={s.label}>Position you&apos;re applying for</Text>
              <View style={{ gap: 8 }} accessibilityRole="radiogroup">
                {[...positions.map((p) => ({ id: p.id, title: p.title, disabled: applied.includes(p.id) })), { id: OTHER_POSITION, title: "Other: a position that isn't listed", disabled: false }].map((o) => {
                  const on = v.positionId === o.id;
                  return (
                    <Pressable key={o.id} disabled={o.disabled} onPress={() => set("positionId")(o.id)} accessibilityRole="radio" aria-checked={on} aria-disabled={o.disabled}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderRadius: radius.control, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.infoBg : colors.white, opacity: o.disabled ? 0.5 : 1 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: on ? colors.ink : colors.steel, alignItems: "center", justifyContent: "center" }}>
                        {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink }} />}
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, color: colors.body }}>{o.title}{o.disabled ? " (already applied)" : ""}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.positionId && <Text style={s.error}>{errors.positionId}</Text>}
              {selected && <Muted>{[selected.department, selected.location, EMPLOYMENT_TYPES[selected.employment_type], selected.application_deadline && `Apply by ${fmtDate(selected.application_deadline)}`].filter(Boolean).join("   ")}</Muted>}
              {v.positionId === OTHER_POSITION && <TextField label="Which position or field are you interested in?" value={v.otherPosition} onChangeText={set("otherPosition")} error={errors.otherPosition} hint="For example: Data analyst, or Marketing" />}
            </>
          )}
          {step === 1 && (
            <>
              <TextField label="First name" value={v.firstName} onChangeText={set("firstName")} autoComplete="given-name" error={errors.firstName} />
              <TextField label="Last name" value={v.lastName} onChangeText={set("lastName")} autoComplete="family-name" error={errors.lastName} />
              <TextField label="Email address" value={v.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
              <TextField label="Phone number" value={v.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" error={errors.phone} hint="Include the country code, e.g. +389" />
              <TextField label="Full address" value={v.address} onChangeText={set("address")} autoComplete="street-address" error={errors.address} />
              <TextField label="City" value={v.city} onChangeText={set("city")} error={errors.city} />
              <TextField label="Country" value={v.country} onChangeText={set("country")} autoComplete="country" error={errors.country} />
              <Checkbox checked={saveProfile} onChange={setSaveProfile} label="Save these details to my profile for next time" />
            </>
          )}
          {step === 2 && (
            <>
              {slot("cv", "CV / Resume", true)}
              {slot("cover_letter", "Cover letter", true)}
              {slot("other", "Additional documents or certificates", false)}
              <Muted>Files are stored privately and are only visible to you and our recruitment team.</Muted>
            </>
          )}
          {step === 3 && (
            <TextField label="Is there anything else you would like us to know about you?" optional multiline value={v.additionalInfo}
              onChangeText={set("additionalInfo")} maxLength={5000} error={errors.additionalInfo}
              placeholder="Your experience, motivation, availability, or anything else relevant." hint={`${v.additionalInfo.length.toLocaleString()} / 5,000`} />
          )}
          {step === 4 && (
            <>
              {[
                ["Position", v.positionId === OTHER_POSITION ? v.otherPosition : selected?.title ?? "", 0],
                ["Personal details", `${v.firstName} ${v.lastName}\n${v.email}, ${v.phone}\n${v.address}, ${v.city}, ${v.country}`, 1],
                ["Documents", [docs.cv && `CV: ${docs.cv.name}`, docs.cover_letter && `Cover letter: ${docs.cover_letter.name}`, ...docs.other.map((f) => `Additional: ${f.name}`)].filter(Boolean).join("\n"), 2],
                ["Additional information", v.additionalInfo || "Nothing added", 3],
              ].map(([title, body, n]) => (
                <View key={title as string} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={s.label}>{title}</Text>
                    <LinkText onPress={() => go(n as number)}>Edit</LinkText>
                  </View>
                  <Body>{body}</Body>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Checkbox checked={v.consentAccuracy} onChange={set("consentAccuracy")} error={errors.consentAccuracy}
                label="I confirm that the information I've provided is accurate and complete." />
              <Checkbox checked={v.consentPrivacy} onChange={set("consentPrivacy")} error={errors.consentPrivacy}
                label={<>I accept the <LinkText onPress={() => void WebBrowser.openBrowserAsync(`${env.siteUrl}/privacy`)}>Privacy Policy</LinkText> and consent to the processing of my personal data for recruitment purposes.</>} />
            </>
          )}
        </Card>

        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          {step > 0 ? <Button title="Back" variant="ghost" onPress={() => go(step - 1)} disabled={busy === "submit"} /> : <View />}
          {step < STEPS.length - 1
            ? <Button title="Continue" onPress={next} disabled={!!busy} style={{ flex: 1 }} />
            : <Button title="Submit application" onPress={() => void submit()} loading={busy === "submit"} style={{ flex: 1 }} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

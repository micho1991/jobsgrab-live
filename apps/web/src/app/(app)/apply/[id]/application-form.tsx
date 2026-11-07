"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { applicationSchema, OTHER_POSITION, formatBytes, MAX_ADDITIONAL_DOCUMENTS } from "@hr/shared";
import { submitApplication } from "../actions";
import { StepIndicator } from "../step-indicator";
import { FileDrop } from "@/components/file-drop";
import { Field, Label, FieldMessage, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { uploadDocument, discardUpload } from "@/lib/upload";
import { deadlineLabel, employmentLabel, type PositionRow } from "@/lib/positions";
import type { UploadedFile } from "@/lib/applications";

// Short labels for the step indicator; full titles for the section headings.
const STEPS = ["Position", "Your details", "Documents", "About you", "Review"];
const TITLES = ["Position", "Personal details", "Documents", "Additional information", "Review and submit"];

type Values = {
  positionId: string; otherPosition: string;
  firstName: string; lastName: string; email: string; phone: string;
  address: string; city: string; country: string;
  additionalInfo: string; consentAccuracy: boolean; consentPrivacy: boolean;
};

const STEP_FIELDS: (keyof Values | "cv" | "cover_letter")[][] = [
  ["positionId", "otherPosition"],
  ["firstName", "lastName", "email", "phone", "address", "city", "country"],
  ["cv", "cover_letter"],
  ["additionalInfo"],
  ["consentAccuracy", "consentPrivacy"],
];

interface Docs { cv: UploadedFile | null; cover_letter: UploadedFile | null; other: UploadedFile[] }

interface Props {
  userId: string;
  positions: PositionRow[];
  appliedPositionIds: string[];
  initialPositionId: string;
  defaults: Omit<Values, "positionId" | "otherPosition" | "additionalInfo" | "consentAccuracy" | "consentPrivacy">;
}

export function ApplicationForm({ userId, positions, appliedPositionIds, initialPositionId, defaults }: Props) {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [values, setValues] = useState<Values>({
    positionId: initialPositionId, otherPosition: "", additionalInfo: "",
    consentAccuracy: false, consentPrivacy: false, ...defaults,
  });
  const [docs, setDocs] = useState<Docs>({ cv: null, cover_letter: null, other: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitted = useRef(false);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => { const { [k]: _, ...rest } = e; return rest; });
  };

  // Warn before leaving with uploaded-but-unsubmitted files.
  const hasUploads = !!(docs.cv || docs.cover_letter || docs.other.length);
  useEffect(() => {
    if (!hasUploads) return;
    const warn = (e: BeforeUnloadEvent) => { if (!submitted.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUploads]);

  useEffect(() => { headingRef.current?.focus(); }, [step]);

  function validate(stepIndex: number): Record<string, string> {
    const fields = STEP_FIELDS[stepIndex]!;
    const out: Record<string, string> = {};
    const isFinal = stepIndex === STEPS.length - 1;
    const parsed = applicationSchema.safeParse(isFinal ? values : { ...values, consentAccuracy: true, consentPrivacy: true });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if ((fields as string[]).includes(key) && !out[key]) out[key] = issue.message;
      }
    }
    if (fields.includes("cv") && !docs.cv) out.cv = "Upload your CV to continue";
    if (fields.includes("cover_letter") && !docs.cover_letter) out.cover_letter = "Upload a cover letter to continue";
    return out;
  }

  function next() {
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n); setMaxReached((m) => Math.max(m, n)); setFormError(undefined);
    window.scrollTo({ top: 0 });
  }

  async function addFiles(kind: keyof Docs, files: File[]) {
    setErrors((e) => { const { [kind]: _, ...rest } = e; return rest; });
    for (const f of files) {
      if (kind === "other" && docs.other.length >= MAX_ADDITIONAL_DOCUMENTS) {
        setErrors((e) => ({ ...e, other: `You can attach up to ${MAX_ADDITIONAL_DOCUMENTS} additional documents.` }));
        return;
      }
      const res = await uploadDocument(userId, f);
      if (res.error || !res.file) { setErrors((e) => ({ ...e, [kind]: res.error ?? "Upload failed" })); return; }
      const uploaded = res.file;
      setDocs((d) => kind === "other" ? { ...d, other: [...d.other, uploaded] } : { ...d, [kind]: uploaded });
    }
  }

  function removeFile(kind: keyof Docs, index = 0) {
    const file = kind === "other" ? docs.other[index] : docs[kind];
    if (file) void discardUpload(file.path);
    setDocs((d) => kind === "other" ? { ...d, other: d.other.filter((_, i) => i !== index) } : { ...d, [kind]: null });
  }

  function submit() {
    const errs = validate(STEPS.length - 1);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const documents = [
      docs.cv && { kind: "cv", storage_path: docs.cv.path, file_name: docs.cv.name },
      docs.cover_letter && { kind: "cover_letter", storage_path: docs.cover_letter.path, file_name: docs.cover_letter.name },
      ...docs.other.map((f) => ({ kind: "other", storage_path: f.path, file_name: f.name })),
    ].filter(Boolean);
    submitted.current = true;
    startTransition(async () => {
      const res = await submitApplication({ values, documents, saveToProfile });
      // Only reached on failure; success redirects.
      submitted.current = false;
      setFormError(res.error);
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        const firstStep = STEP_FIELDS.findIndex((f) => f.some((k) => k in res.fieldErrors!));
        if (firstStep >= 0) setStep(firstStep);
      }
    });
  }

  const selected = positions.find((p) => p.id === values.positionId);
  const isOther = values.positionId === OTHER_POSITION;
  const positionName = isOther ? values.otherPosition || "Other position" : selected?.title ?? "";

  return (
    <div className="grid gap-8">
      <StepIndicator steps={STEPS} current={step} maxReached={maxReached} onSelect={setStep} />

      <div className="rounded-[var(--radius-panel)] border border-line bg-white p-5 sm:p-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl outline-none">{TITLES[step]}</h2>
        {formError && <Alert tone="error" className="mt-5">{formError}</Alert>}

        <div className="mt-6">
          {step === 0 && (
            <div className="grid gap-5">
              <div>
                <Label htmlFor="positionId">Position you&rsquo;re applying for</Label>
                <select id="positionId" value={values.positionId} onChange={(e) => set("positionId", e.target.value)}
                  aria-invalid={!!errors.positionId} aria-describedby={errors.positionId ? "positionId-error" : undefined}
                  className={`${inputClass(!!errors.positionId)} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M4 6l4 4 4-4%22 fill=%22none%22 stroke=%22%235D7A99%22 stroke-width=%221.6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`}>
                  <option value="">Select a position</option>
                  {positions.map((p) => {
                    const applied = appliedPositionIds.includes(p.id);
                    return <option key={p.id} value={p.id} disabled={applied}>{p.title}{applied ? " (already applied)" : ""}</option>;
                  })}
                  <option value={OTHER_POSITION}>Other: a position that isn&rsquo;t listed</option>
                </select>
                <FieldMessage id="positionId" error={errors.positionId} />
              </div>

              {selected && (
                <div className="rounded-[var(--radius-control)] bg-mist px-4 py-3 text-sm">
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                    {selected.department && <span>{selected.department}</span>}
                    {selected.location && <span>{selected.location}</span>}
                    <span>{employmentLabel(selected.employment_type)}</span>
                    {deadlineLabel(selected.application_deadline) && <span className="text-ink">{deadlineLabel(selected.application_deadline)}</span>}
                  </p>
                  {selected.description && <p className="mt-2 line-clamp-4 whitespace-pre-line text-body">{selected.description}</p>}
                </div>
              )}

              {isOther && (
                <Field label="Which position or field are you interested in?" name="otherPosition" maxLength={150}
                  value={values.otherPosition} onChange={(e) => set("otherPosition", e.target.value)}
                  error={errors.otherPosition} hint="For example: Data analyst, or Marketing" />
              )}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" name="firstName" autoComplete="given-name" maxLength={100}
                value={values.firstName} onChange={(e) => set("firstName", e.target.value)} error={errors.firstName} />
              <Field label="Last name" name="lastName" autoComplete="family-name" maxLength={100}
                value={values.lastName} onChange={(e) => set("lastName", e.target.value)} error={errors.lastName} />
              <Field label="Email address" name="email" type="email" autoComplete="email"
                value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
              <Field label="Phone number" name="phone" type="tel" autoComplete="tel" maxLength={30}
                value={values.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone}
                hint="Include the country code, e.g. +389" />
              <Field label="Full address" name="address" autoComplete="street-address" maxLength={255} className="sm:col-span-2"
                value={values.address} onChange={(e) => set("address", e.target.value)} error={errors.address} />
              <Field label="City" name="city" autoComplete="address-level2" maxLength={100}
                value={values.city} onChange={(e) => set("city", e.target.value)} error={errors.city} />
              <Field label="Country" name="country" autoComplete="country-name" maxLength={100}
                value={values.country} onChange={(e) => set("country", e.target.value)} error={errors.country} />
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
                Save these details to my profile for next time
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6">
              <FileDrop label="CV / Resume" required error={errors.cv}
                files={docs.cv ? [docs.cv] : []} onFiles={(f) => addFiles("cv", f)} onRemove={() => removeFile("cv")} />
              <FileDrop label="Cover letter" required error={errors.cover_letter}
                files={docs.cover_letter ? [docs.cover_letter] : []} onFiles={(f) => addFiles("cover_letter", f)} onRemove={() => removeFile("cover_letter")} />
              <FileDrop label="Additional documents or certificates" multiple error={errors.other}
                description={`PDF, DOC or DOCX, up to 10 MB each, ${MAX_ADDITIONAL_DOCUMENTS} files at most`}
                files={docs.other} onFiles={(f) => addFiles("other", f)} onRemove={(i) => removeFile("other", i)} />
              <p className="text-sm text-muted">Files are stored privately and are only visible to you and our recruitment team.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <Label htmlFor="additionalInfo" optional>Is there anything else you would like us to know about you?</Label>
              <textarea id="additionalInfo" rows={8} maxLength={5000} value={values.additionalInfo}
                onChange={(e) => set("additionalInfo", e.target.value)}
                aria-invalid={!!errors.additionalInfo} aria-describedby="additionalInfo-hint"
                className={`${inputClass(!!errors.additionalInfo)} h-auto py-2.5 leading-relaxed`}
                placeholder="Your experience, what motivates you, your availability, or anything else relevant to your application." />
              <p id="additionalInfo-hint" className="mt-1.5 flex justify-between text-sm text-muted">
                <span>{errors.additionalInfo}</span>
                <span className="tabular-nums">{values.additionalInfo.length.toLocaleString()} / 5,000</span>
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-6">
              <ReviewSection title="Position" onEdit={() => setStep(0)}>
                <p className="font-medium text-ink">{positionName}</p>
              </ReviewSection>
              <ReviewSection title="Personal details" onEdit={() => setStep(1)}>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <ReviewItem label="Name" value={`${values.firstName} ${values.lastName}`} />
                  <ReviewItem label="Email" value={values.email} />
                  <ReviewItem label="Phone" value={values.phone} />
                  <ReviewItem label="Address" value={`${values.address}, ${values.city}, ${values.country}`} />
                </dl>
              </ReviewSection>
              <ReviewSection title="Documents" onEdit={() => setStep(2)}>
                <ul className="grid gap-1 text-sm">
                  {[docs.cv && ["CV", docs.cv], docs.cover_letter && ["Cover letter", docs.cover_letter],
                    ...docs.other.map((f) => ["Additional", f] as const)].filter(Boolean).map((entry) => {
                    const [label, f] = entry as [string, UploadedFile];
                    return <li key={f.path}><span className="text-muted">{label}:</span> <span className="text-ink">{f.name}</span> <span className="text-muted">({formatBytes(f.size)})</span></li>;
                  })}
                </ul>
              </ReviewSection>
              <ReviewSection title="Additional information" onEdit={() => setStep(3)}>
                <p className="whitespace-pre-line text-sm">{values.additionalInfo || <span className="text-muted">Nothing added</span>}</p>
              </ReviewSection>

              <fieldset className="grid gap-3 border-t border-line pt-6">
                <legend className="sr-only">Consent</legend>
                <ConsentBox checked={values.consentAccuracy} onChange={(v) => set("consentAccuracy", v)} error={errors.consentAccuracy} id="consentAccuracy">
                  I confirm that the information I&rsquo;ve provided is accurate and complete.
                </ConsentBox>
                <ConsentBox checked={values.consentPrivacy} onChange={(v) => set("consentPrivacy", v)} error={errors.consentPrivacy} id="consentPrivacy">
                  I accept the <Link href="/privacy" target="_blank" className="text-ink underline underline-offset-2">Privacy Policy</Link> and
                  consent to the processing of my personal data for recruitment purposes.
                </ConsentBox>
              </fieldset>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          {step > 0
            ? <Button variant="ghost" type="button" onClick={() => setStep(step - 1)} disabled={pending}>Back</Button>
            : <span />}
          {step < STEPS.length - 1
            ? <Button type="button" onClick={next} size="lg">Continue</Button>
            : <Button type="button" onClick={submit} size="lg" disabled={pending} aria-busy={pending}>
                {pending && <Spinner />}{pending ? "Submitting…" : "Submit application"}
              </Button>}
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[15px]">{title}</h3>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-steel underline-offset-2 hover:text-ink hover:underline">
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      </div>
      {children}
    </section>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted">{label}</dt><dd className="break-words text-ink">{value}</dd></div>;
}

function ConsentBox({ id, checked, onChange, error, children }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3 text-sm leading-relaxed">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]" />
        <span>{children}</span>
      </label>
      {error && <p id={`${id}-error`} className="mt-1 pl-7 text-sm text-bad">{error}</p>}
    </div>
  );
}

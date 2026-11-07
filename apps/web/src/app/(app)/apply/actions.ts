"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applicationSchema, OTHER_POSITION, PRIVACY_POLICY_VERSION, friendlyError } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/forms";
import { UUID_RE } from "@/lib/format";

const documentsSchema = z.array(z.object({
  kind: z.enum(["cv", "cover_letter", "other"]),
  storage_path: z.string().max(200),
  file_name: z.string().trim().min(1).max(255),
})).max(12);

export interface SubmitResult { error?: string; fieldErrors?: Record<string, string> }

export async function submitApplication(input: {
  values: Record<string, unknown>;
  documents: unknown;
  saveToProfile: boolean;
}): Promise<SubmitResult> {
  const parsed = applicationSchema.safeParse(input.values);
  if (!parsed.success) return { error: "Some answers need attention.", fieldErrors: fieldErrors(parsed.error) };
  const docs = documentsSchema.safeParse(input.documents);
  if (!docs.success) return { error: "Your documents couldn't be read. Remove them and upload them again." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again to continue." };
  if (docs.data.some((d) => !d.storage_path.startsWith(`${user.id}/`))) {
    return { error: "Your documents couldn't be verified. Upload them again." };
  }

  const v = parsed.data;
  const isOther = v.positionId === OTHER_POSITION;
  if (!isOther && !UUID_RE.test(v.positionId)) return { fieldErrors: { positionId: "Select a position" } };

  // The database function re-checks everything: open position, no duplicate,
  // consents, exactly one CV + cover letter, and file ownership in storage.
  const { data, error } = await supabase.rpc("submit_application", {
    p_position_id: isOther ? null : v.positionId,
    p_other_position: isOther ? v.otherPosition ?? null : null,
    p_first_name: v.firstName,
    p_last_name: v.lastName,
    p_email: v.email,
    p_phone: v.phone,
    p_address: v.address,
    p_city: v.city,
    p_country: v.country,
    p_additional_info: v.additionalInfo || null,
    p_consent_accuracy: v.consentAccuracy,
    p_consent_privacy: v.consentPrivacy,
    p_documents: docs.data,
    p_privacy_policy_version: PRIVACY_POLICY_VERSION,
  });
  if (error || !data) return { error: friendlyError(error) };

  if (input.saveToProfile) {
    await supabase.from("profiles").update({
      first_name: v.firstName, last_name: v.lastName,
      phone: v.phone, address: v.address, city: v.city, country: v.country,
    }).eq("id", user.id);
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/applications/${(data as { id: string }).id}?notice=submitted`);
}

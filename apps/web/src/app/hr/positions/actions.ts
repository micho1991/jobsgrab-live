"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { positionSchema, friendlyError } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formValues, type FormState } from "@/lib/forms";

const NO_PERMISSION = "Only HR admins can manage positions.";

export async function savePosition(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["id", "title", "department", "location", "employmentType", "description", "applicationDeadline", "status"]);
  const parsed = positionSchema.safeParse({
    ...values,
    applicationDeadline: values.applicationDeadline || null,
    isActive: fd.get("isActive") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { ...values, isActive: fd.get("isActive") === "on" ? "on" : "" } };
  const v = parsed.data;
  const row = {
    title: v.title, department: v.department || null, location: v.location || null, employment_type: v.employmentType,
    description: v.description, application_deadline: v.applicationDeadline ?? null, status: v.status, is_active: v.isActive,
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again." };

  const id = values.id && z.string().uuid().safeParse(values.id).success ? values.id : null;
  const { data, error } = id
    ? await supabase.from("positions").update(row).eq("id", id).select("id")
    : await supabase.from("positions").insert({ ...row, created_by: user.id }).select("id");
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : friendlyError(error), values };
  if (!data?.length) return { error: NO_PERMISSION, values };

  revalidatePath("/hr/positions"); revalidatePath("/");
  redirect(`/hr/positions?saved=${encodeURIComponent(v.title)}`);
}

/** Quick toggles from the positions list. */
export async function setPositionFlag(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const field = String(fd.get("field") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  if (field === "is_active") await supabase.from("positions").update({ is_active: fd.get("value") === "true" }).eq("id", id);
  if (field === "status") await supabase.from("positions").update({ status: fd.get("value") === "open" ? "open" : "closed" }).eq("id", id);
  revalidatePath("/hr/positions"); revalidatePath("/");
}

export async function deletePosition(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  // Fails (FK restrict) if anyone has applied; the UI only offers delete when there are none.
  await supabase.from("positions").delete().eq("id", id);
  revalidatePath("/hr/positions"); revalidatePath("/");
  redirect("/hr/positions");
}

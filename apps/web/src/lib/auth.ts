import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isHrRole, type AppRole } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  role: AppRole;
  created_at: string;
}

/** Current user + profile, deduplicated per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, phone, address, city, country, role, created_at")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) return null;
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  return { user, profile, hasPassword: providers.includes("email") };
});

export async function requireUser(next = "/dashboard") {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function requireHr() {
  const session = await requireUser("/hr");
  if (!isHrRole(session.profile.role)) redirect("/dashboard");
  return session;
}

export const displayName = (p: Pick<Profile, "first_name" | "last_name" | "email">) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;

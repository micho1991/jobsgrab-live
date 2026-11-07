import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

/** Landing for the branded email templates: verifies ?token_hash= and signs the user in. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/reset-password" : "/dashboard";
  const next = safeNext(searchParams.get("next"), fallback);

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const url = new URL(next, request.url);
      if (type === "email" || type === "signup") url.searchParams.set("notice", "email-confirmed");
      return NextResponse.redirect(url);
    }
  }
  const reason = type === "recovery" ? "reset" : "link";
  return NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, request.url));
}

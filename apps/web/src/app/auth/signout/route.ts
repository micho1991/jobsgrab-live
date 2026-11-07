import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only, so a link or image tag on another site can't sign people out.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?notice=signed-out", request.url), { status: 303 });
}

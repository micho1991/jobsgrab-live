import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/csp";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  return updateSession(request, { "x-nonce": nonce, "Content-Security-Policy": csp });
}

export const config = {
  // Everything except static assets and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};

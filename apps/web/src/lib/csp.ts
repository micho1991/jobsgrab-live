import { env } from "@/lib/env";

/**
 * Content Security Policy with a per-request nonce. Next.js reads the nonce from
 * the request's CSP header and applies it to its own scripts, so only those run.
 * Data can only be sent to this site and the Supabase project.
 */
export function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const supabase = env.supabaseUrl.replace(/\/$/, "");
  const supabaseWs = supabase.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",           // Next/React inline style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs}`, // direct uploads to Storage
    // Google sign-in posts to our server action, which redirects to Supabase, then Google
    `form-action 'self' ${supabase} https://accounts.google.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(supabase.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

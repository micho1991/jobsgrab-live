import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const PROTECTED = ["/dashboard", "/account", "/apply", "/applications", "/hr"];
const GUEST_ONLY = ["/login", "/register"];

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + "/"));

/**
 * Refreshes the auth session on every request and applies coarse route
 * protection. Fine-grained authorization (HR role, data ownership) is enforced
 * in layouts and, ultimately, by Row-Level Security in the database.
 */
export async function updateSession(request: NextRequest, securityHeaders: Record<string, string> = {}) {
  // Pass the CSP/nonce to the app on the request, rebuilding headers whenever
  // cookies change so refreshed auth cookies reach server components too.
  const next = () => {
    const headers = new Headers(request.headers);
    for (const [k, v] of Object.entries(securityHeaders)) headers.set(k, v);
    return NextResponse.next({ request: { headers } });
  };
  const withSecurity = <T extends NextResponse>(res: T) => {
    const csp = securityHeaders["Content-Security-Policy"];
    if (csp) res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  let response = next();

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth; never trust getSession() on the server.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return withSecurity(res);
  };

  if (!user && matches(path, PROTECTED)) {
    return redirectTo("/login", { next: path + request.nextUrl.search });
  }
  if (user && matches(path, GUEST_ONLY)) {
    return redirectTo("/dashboard");
  }
  return withSecurity(response);
}

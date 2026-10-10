import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

// Paths reachable without signing in, with everything below them.
const PUBLIC_PATHS = ["/logga-in", "/auth"];
// Reachable without signing in, but not their sub-paths (Kom igång 1 is the
// sign-up step; the later steps need an account).
const PUBLIC_EXACT_PATHS = ["/kom-igang"];

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_EXACT_PATHS.includes(pathname.replace(/\/+$/, "")) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to the login page. This is an optimistic check only; data access
 * is enforced by RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes
  // the session and must see the request's cookies first.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/logga-in";
    loginUrl.search = "";
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") loginUrl.searchParams.set("next", next);
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

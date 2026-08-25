import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { buildCspHeader } from "@/lib/csp";

/**
 * Three unrelated jobs share this file because Next.js only allows one
 * middleware: (1) stamp every request with an `x-pathname` header so the
 * root layout can derive `<html lang/dir>` from the URL server-side (see
 * layout.tsx); (2) generate a per-request CSP nonce and enforced CSP header
 * (see csp.ts); (3) refresh the Supabase session cookie and gate `/admin/*`
 * — real DB-adjacent work, kept behind the existing `/admin` check so public
 * pages don't pay for it. The deeper admin check (does this session belong
 * to an actual admin_profiles row, not just any authenticated user) happens
 * in `/admin/layout.tsx`, which can afford a real DB query; middleware
 * stays cheap.
 *
 * x-pathname/x-nonce are set on the *request* (via the `request: { headers
 * }` form), not the response — internal plumbing for headers() in Server
 * Components, not something that should leak into the actual HTTP response
 * a browser or crawler receives. The CSP itself IS a response header (that's
 * the only way a browser ever sees it), and is enforced (not report-only):
 * verified with zero violations by browsing the live public site before
 * flipping it. The admin dashboard needs no additional external sources —
 * same script/style/connect origins, confirmed by reading every script tag
 * and fetch/XHR call it makes — but wasn't smoke-tested logged-in from this
 * environment; do that once after deploying, and revert this one header
 * name back to `Content-Security-Policy-Report-Only` if anything there
 * turns out to need a directive this doesn't already allow (see csp.ts).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCspHeader(nonce);

  const requestHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    headers.set("x-nonce", nonce);
    return headers;
  };

  if (!pathname.startsWith("/admin")) {
    const response = NextResponse.next({ request: { headers: requestHeaders() } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  let response = NextResponse.next({ request: { headers: requestHeaders() } });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders() } });
          response.headers.set("Content-Security-Policy", csp);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute = pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (isAdminRoute && !user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/admin/login" && user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|json)$).*)"],
};

/**
 * Builds the Content-Security-Policy value for one request, given its nonce.
 *
 * Shipped as an enforced Content-Security-Policy (see middleware.ts) — was
 * Content-Security-Policy-Report-Only during development so a wrong
 * directive would show up as a visible violation instead of silently
 * breaking GA/GTM/Meta Pixel/Supabase calls. Flipped to enforced for the
 * production launch audit after browsing the live public site (every page,
 * the video/service/testimonial modals, the contact form, the mobile nav)
 * with zero console CSP violations. If a legitimate external resource is
 * ever added later (a new analytics vendor, a real Google Maps `<iframe>`,
 * etc.), add its origin to the relevant directive below — don't just widen
 * things to `*` or reach for `unsafe-inline`/`unsafe-eval`.
 *
 * The one exception is development mode itself: `next dev`'s hot-reload
 * client uses eval() and a plain ws:// connection, so `buildCspHeader()`
 * adds `'unsafe-eval'` and localhost connect-src entries ONLY when
 * `NODE_ENV === "development"` — never true for the `next build`/`next
 * start` pair that actually deploys, so production stays exactly as strict
 * as verified.
 *
 * Domain allowlist reasoning (see AnalyticsScripts.tsx, settings repo):
 * - script-src: 'nonce' + 'strict-dynamic' covers GTM/gtag/Meta Pixel's own
 *   inline bootstrap AND whatever scripts they dynamically inject after —
 *   strict-dynamic propagates trust from a nonced script to its children,
 *   so no explicit googletagmanager.com/facebook.net entries are needed.
 * - connect-src: explicit, since strict-dynamic doesn't cover fetch/XHR/
 *   beacon destinations. Supabase is here because the admin dashboard's
 *   CRUD hooks talk to it directly from the browser (not just server-side).
 * - frame-src: 'self' plus youtube.com — the video library modal embeds a
 *   real YouTube <iframe> on click (interaction-audit fix), so this is a
 *   live requirement, not a placeholder. Add https://www.google.com here if
 *   the Contact page map ever becomes a real <iframe> embed instead of the
 *   current "open in Google Maps" link-out.
 * - style-src needs 'unsafe-inline': Framer Motion drives its animations
 *   via inline `style` attributes, and CSP nonces cannot cover inline style
 *   *attributes* (only <style> blocks/<link> tags) — this is a real CSP
 *   spec limitation, not an oversight. Locking down script-src is what
 *   actually matters for XSS; style-src 'unsafe-inline' is the standard,
 *   accepted trade-off for any animation library that works this way.
 */
function supabaseOrigin(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
  } catch {
    return null;
  }
}

export function buildCspHeader(nonce: string): string {
  const supabase = supabaseOrigin();
  // `next dev`'s webpack HMR wraps modules in eval() and talks to the
  // browser over a plain-http/ws websocket — both are genuine requirements
  // of the dev tooling itself, not app code, and only exist when NODE_ENV
  // is "development" (never true for `next build`/`next start`, which is
  // what actually ships to Hostinger). Without this, dev mode's own
  // hot-reload machinery gets blocked by its own CSP — a real regression
  // this fixes, not a loosening of the production policy below.
  const isDev = process.env.NODE_ENV === "development";
  const connectSrc = [
    "'self'",
    supabase,
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://region1.google-analytics.com",
    "https://www.facebook.com",
    isDev && "ws://localhost:*",
    isDev && "http://localhost:*",
  ]
    .filter(Boolean)
    .join(" ");
  const scriptSrc = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: https:`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src ${connectSrc}`,
    `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
  ];
  return directives.join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: import.meta.dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // CMS-uploaded media (Supabase Storage public bucket) — without this,
      // next/image fails to optimize/serve any admin-uploaded image.
      {
        protocol: "https",
        hostname: "qsxtivgcxikyamkmegwo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      // The old static site served the homepage from home.html, so "/home"
      // is muscle memory / a bookmarked habit — send it to the real route.
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/home.html",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async headers() {
    // CSP itself is NOT set here — it needs a fresh nonce per request, so
    // it's generated and enforced in middleware.ts (see src/lib/csp.ts);
    // these are the static headers that don't need per-request data. Vercel
    // does not add HSTS automatically — it's the app's responsibility to set it.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

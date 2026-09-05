import type { Metadata } from "next";
import { Manrope, Cairo } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { headers } from "next/headers";
import { getSiteSettings } from "@/server/repositories/settings";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOrganizationSchema, buildWebSiteSchema } from "@/lib/seo/schema";
import { getSiteUrl } from "@/lib/seo/site";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Cairo: a premium, professional Arabic typeface with a wide weight range
// that reads at the same register as Manrope — used only when Arabic is
// active (see fontFamily.arabic in tailwind.config.ts), so English keeps
// its exact existing typography untouched.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

// Every field below is CMS-editable (Site Settings → Global SEO); the
// literals are safe fallbacks only, used when that field has never been
// filled in — not a permanent hardcoded value.
export async function generateMetadata(): Promise<Metadata> {
  const [settings, requestHeaders] = await Promise.all([getSiteSettings(), headers()]);
  const lang = (requestHeaders.get("x-pathname") || "/").startsWith("/ar") ? "ar" : "en";
  const siteUrl = getSiteUrl();

  const defaultTitle =
    (lang === "ar" ? settings.defaultTitleAr : settings.defaultTitleEn) ||
    `${settings.doctorNameEn} | Elite Neurosurgery & Neurology`;
  const titleTemplate =
    (lang === "ar" ? settings.titleTemplateAr : settings.titleTemplateEn) || `%s | ${settings.doctorNameEn}`;
  const defaultDescription =
    (lang === "ar" ? settings.defaultDescriptionAr : settings.defaultDescriptionEn) ||
    "Dr. Ayman Tarek — global excellence in neurosurgery, spine care, and neuro-oncology. Precision surgery, life reimagined.";
  const defaultKeywords = lang === "ar" ? settings.defaultKeywordsAr : settings.defaultKeywordsEn;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: titleTemplate,
    },
    description: defaultDescription,
    keywords: defaultKeywords.length > 0 ? defaultKeywords : undefined,
    applicationName: settings.doctorNameEn,
    authors: [{ name: settings.doctorNameEn }],
    creator: settings.doctorNameEn,
    publisher: settings.clinicNameEn || settings.doctorNameEn,
    icons: settings.faviconUrl ? { icon: settings.faviconUrl, apple: settings.faviconUrl } : undefined,
    manifest: "/manifest.webmanifest",
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: settings.doctorNameEn,
      title: defaultTitle,
      description: defaultDescription,
      url: siteUrl,
      images: settings.defaultOgImageUrl ? [{ url: settings.defaultOgImageUrl, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: settings.defaultTwitterImageUrl ? [settings.defaultTwitterImageUrl] : undefined,
      site: settings.twitterHandle || undefined,
    },
    verification: {
      google: settings.googleSiteVerification || undefined,
      other: {
        ...(settings.bingSiteVerification ? { "msvalidate.01": settings.bingSiteVerification } : {}),
        ...(settings.yandexSiteVerification ? { "yandex-verification": settings.yandexSiteVerification } : {}),
      },
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Middleware stamps every response with the real request pathname (see
  // middleware.ts) — reading it here means <html lang/dir> is correct from
  // the very first byte of server-rendered HTML for both /* (English) and
  // /ar/* (Arabic), no client-side patch-up script needed at all.
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") || "/";
  const lang = pathname.startsWith("/ar") ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const settings = await getSiteSettings();

  return (
    <html lang={lang} dir={dir} className={`dark ${manrope.variable} ${cairo.variable}`}>
      {/* App Router root-layout <head> is the documented escape hatch for tags the
          Metadata API doesn't cover (icon-font stylesheet). The no-page-custom-font
          rule predates App Router and false-positives on the font link below. */}
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {settings.supabaseAssetHost && <link rel="preconnect" href={settings.supabaseAssetHost} />}
      </head>
      <body className="min-h-screen font-sans rtl:font-arabic antialiased">
        <JsonLd data={buildOrganizationSchema(settings)} />
        <JsonLd data={buildWebSiteSchema(settings)} />
        {/* reducedMotion="user" makes every motion.* component site-wide
            automatically honor the OS-level prefers-reduced-motion setting
            (swaps transform/scale animations for instant or opacity-only) —
            one place instead of gating each animation individually. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}

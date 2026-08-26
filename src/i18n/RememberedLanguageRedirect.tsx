"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { languageFromPathname, localizedHref } from "@/lib/localizedHref";

/**
 * Client-side only, never in middleware/SSR — crawlers and anyone hitting a
 * URL directly always get exactly what that URL declares (so this can never
 * read as cloaking, and every canonical/hreflang/sitemap URL keeps serving
 * exactly the language it claims). One-directional and one-shot: Arabic is
 * the site's default language, so unless a visitor has explicitly landed on
 * or switched to an English page before (which stamps localStorage "en" —
 * see LanguageProvider), an unprefixed (English) URL sends them to its /ar
 * equivalent once, on first mount of the (site) shell. A visitor who *has*
 * used English before, or who explicitly navigates straight to a /ar/... URL
 * (e.g. a shared link), is never overridden either way — this only ever
 * fires toward Arabic, and only in the absence of a real English signal.
 * Never re-checks after the first run, so it can't fight a language-switch
 * click later in the session.
 */
export function RememberedLanguageRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    try {
      const remembered = window.localStorage.getItem("language");
      if (remembered !== "en" && languageFromPathname(pathname) === "en") {
        router.replace(localizedHref(pathname, "ar"));
      }
    } catch {
      /* localStorage unavailable — no remembered preference to honor */
    }
    // Intentionally runs once per mount of the (site) shell, not on every
    // pathname change — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

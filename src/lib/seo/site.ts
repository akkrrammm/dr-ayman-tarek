/** Single source of truth for the production origin — every canonical URL,
 * OG url, hreflang alternate, sitemap entry, and JSON-LD `url` field derives
 * from this so there is never more than one place to update it. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://dr-aymantarek.com").replace(/\/$/, "");
}

/** Joins a root-relative path onto the site origin. */
export function absoluteUrl(path: string): string {
  const siteUrl = getSiteUrl();
  if (!path || path === "/") return siteUrl + "/";
  return siteUrl + (path.startsWith("/") ? path : `/${path}`);
}

// @tiptap/html, NOT @tiptap/core — @tiptap/core's generateHTML() calls
// ProseMirror's DOMSerializer directly, which needs a real `window` and
// throws `ReferenceError: window is not defined` in a Node/Server Component
// context. @tiptap/html is the purpose-built package for exactly this:
// server-side HTML generation, backed by its own bundled lightweight DOM
// (linkedom) instead of a browser global. Confirmed by reproducing the
// error directly — every blog post was silently falling back to its excerpt
// instead of real content because of this exact mismatch.
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import sanitizeHtml from "sanitize-html";

const EXTENSIONS = [
  // StarterKit bundles its own Link extension as of Tiptap v3 — disable it
  // here so the explicit LinkExtension.configure() below (with our own
  // openOnClick/autolink options) doesn't collide with it (was logging
  // "Duplicate extension names found: ['link']" on every render).
  StarterKit.configure({ link: false }),
  LinkExtension.configure({ openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] }),
  ImageExtension,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

// Sanitized to exactly what the editor's toolbar (RichTextEditor.tsx) and
// the EXTENSIONS set above can actually produce — defense-in-depth, not a
// feature restriction: an admin account is trusted, but the stored value is
// a JSON document, not the HTML itself, so this is the one place that
// guarantees dangerouslySetInnerHTML (BlogPostDetail.tsx) only ever
// receives markup from this fixed, known-safe tag/attribute set, even if
// that JSON were ever edited outside the editor (a compromised admin
// session, a direct DB edit, a future import feature).
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "em", "s", "u", "code", "pre",
    "ul", "ol", "li",
    "blockquote",
    "a", "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["style"],
  },
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
};

/** Same extension set as the admin BilingualRichText editor (see
 * RichTextEditor.tsx) — read-only server-side render of stored Tiptap JSON
 * into the HTML string the blog post detail page dangerously-sets, styled
 * via the shared .rich-text-content CSS class. */
export function renderRichTextHtml(json: unknown): string {
  if (!json || typeof json !== "object" || Object.keys(json as object).length === 0) return "";
  try {
    const html = generateHTML(json as Parameters<typeof generateHTML>[0], EXTENSIONS);
    return sanitizeHtml(html, SANITIZE_OPTIONS);
  } catch (err) {
    // Surface this — a silent catch here is exactly what let the
    // @tiptap/core-vs-@tiptap/html mismatch above hide as "every post shows
    // its excerpt" instead of a visible error.
    console.error("renderRichTextHtml failed:", err);
    return "";
  }
}

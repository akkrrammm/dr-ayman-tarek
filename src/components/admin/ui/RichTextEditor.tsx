"use client";

import { useState } from "react";
import { useEditor, EditorContent, type JSONContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, List, ListOrdered, Link2, ImageIcon, Undo2, Redo2, Heading2, Heading3, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs } from "./Tabs";
import { MediaPickerDialog } from "./MediaPicker";
import { getPublicMediaUrl } from "@/lib/supabase/storage";
import type { MediaAsset } from "@/hooks/useMediaLibrary";

function ToolbarButton({ onClick, active, disabled, label, children }: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30",
        active && "bg-primary/20 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onOpenMedia }: { editor: Editor; onOpenMedia: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-outline-variant/20 p-1.5">
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev || "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Insert image" onClick={onOpenMedia}>
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-outline-variant/20" />
      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

function EditorInstance({ value, onChange, dir, placeholder }: { value: JSONContent | null; onChange: (json: JSONContent) => void; dir: "ltr" | "rtl"; placeholder: string }) {
  const [mediaOpen, setMediaOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      // StarterKit bundles its own Link extension as of Tiptap v3 — disable
      // it so the explicit LinkExtension below doesn't collide with it (was
      // logging "Duplicate extension names found: ['link']").
      StarterKit.configure({ link: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] }),
      ImageExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value && Object.keys(value).length > 0 ? value : undefined,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: { attributes: { class: "rich-text-content min-h-[220px] px-4 py-3 focus:outline-none" } },
    immediatelyRender: false,
  });

  if (!editor) {
    return <div className="min-h-[220px] animate-pulse bg-white/[0.03]" />;
  }

  function handleSelectImage(asset: MediaAsset) {
    editor!.chain().focus().setImage({ src: getPublicMediaUrl(asset.storage_path), alt: asset.alt_text_en || "" }).run();
    setMediaOpen(false);
  }

  return (
    <div dir={dir} className="rounded-xl border border-outline-variant/40 bg-surface-container">
      <Toolbar editor={editor} onOpenMedia={() => setMediaOpen(true)} />
      <EditorContent editor={editor} />
      <MediaPickerDialog open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={handleSelectImage} />
    </div>
  );
}

/** Rich text editor with independent EN/AR editor instances (both stay
 * mounted — switching tabs hides rather than unmounts, so neither loses
 * cursor/undo state). Content is stored as Tiptap JSON in the `content_en`
 * / `content_ar` jsonb columns. */
export function BilingualRichText({
  label,
  valueEn,
  valueAr,
  onChangeEn,
  onChangeAr,
}: {
  label: string;
  valueEn: JSONContent | null;
  valueAr: JSONContent | null;
  onChangeEn: (json: JSONContent) => void;
  onChangeAr: (json: JSONContent) => void;
}) {
  const [tab, setTab] = useState<"en" | "ar">("en");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface-variant">{label}</span>
        <Tabs tabs={[{ key: "en", label: "English" }, { key: "ar", label: "Arabic" }]} active={tab} onChange={(k) => setTab(k as "en" | "ar")} />
      </div>
      <div className={tab === "en" ? "" : "hidden"}>
        <EditorInstance value={valueEn} onChange={onChangeEn} dir="ltr" placeholder="Start writing the English article..." />
      </div>
      <div className={tab === "ar" ? "" : "hidden"}>
        <EditorInstance value={valueAr} onChange={onChangeAr} dir="rtl" placeholder="ابدأ كتابة المقال بالعربية..." />
      </div>
    </div>
  );
}

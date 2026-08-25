"use client";

import { useRef, useState } from "react";
import { Upload, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "./Dialog";
import { AdminButton } from "./Button";
import { MediaGrid } from "@/components/admin/media/MediaGrid";
import { TableSkeleton } from "./Skeleton";
import { useMediaAssets, useUploadMedia, type MediaAsset } from "@/hooks/useMediaLibrary";
import { getPublicMediaUrl, validateMediaFile } from "@/lib/supabase/storage";

/**
 * Reused everywhere a form needs to attach a media asset: page hero
 * backgrounds, service/specialty/video images, blog featured image +
 * gallery, site logo/favicon, testimonial photos. Opens the Media Library
 * in a modal instead of duplicating the grid/upload logic per form.
 */
export function MediaPickerField({
  label,
  valueMediaId,
  valueUrl,
  onChange,
  accept = "image",
}: {
  label: string;
  valueMediaId: string | null;
  valueUrl: string | null;
  onChange: (asset: MediaAsset | null) => void;
  accept?: "image" | "any";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
          {valueUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded asset preview
            <img src={valueUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-6 w-6 text-on-surface-variant/40" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <AdminButton type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            {valueMediaId ? "Change" : "Choose"}
          </AdminButton>
          {valueMediaId && (
            <button type="button" onClick={() => onChange(null)} className="text-left text-xs text-on-surface-variant hover:text-error">
              Remove
            </button>
          )}
        </div>
      </div>
      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        accept={accept}
        onSelect={(asset) => {
          onChange(asset);
          setOpen(false);
        }}
      />
    </div>
  );
}

export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  accept = "image",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  accept?: "image" | "any";
}) {
  const { data: assets, isLoading } = useMediaAssets();
  const upload = useUploadMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = (assets || []).filter((a) => accept === "any" || a.kind === "image");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateMediaFile(file, accept);
    if (validationError) {
      toast.error(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      const asset = await upload.mutateAsync(file);
      toast.success("Uploaded");
      onSelect(asset as MediaAsset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Select Media</h2>
          <AdminButton
            type="button"
            size="sm"
            variant="outline"
            icon={<Upload className="h-4 w-4" />}
            loading={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload New
          </AdminButton>
          <input ref={fileInputRef} type="file" accept={accept === "image" ? "image/*" : undefined} className="hidden" onChange={handleFileChange} />
        </div>
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {isLoading ? (
            <TableSkeleton rows={4} />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-on-surface-variant">No media yet — upload your first file.</p>
          ) : (
            <MediaGrid assets={filtered} onSelect={onSelect} />
          )}
        </div>
      </div>
    </Dialog>
  );
}

export { getPublicMediaUrl };

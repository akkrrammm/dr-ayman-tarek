import { createClient } from "./client";

const BUCKET = "media";

export function getPublicMediaUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function detectKind(mimeType: string): "image" | "video" | "pdf" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "other";
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Uploads a file directly from the browser (respects Storage RLS via the
 * admin's own session — no server action needed for the byte stream) then
 * inserts the matching media_assets row. Single entry point reused by the
 * Media Library page and every inline "Upload new" button inside
 * <MediaPicker>.
 */
export async function uploadMediaAsset(file: File, folderId: string | null = null) {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storagePath = `${crypto.randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const dimensions = await readImageDimensions(file);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      folder_id: folderId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      kind: detectKind(file.type),
      file_size: file.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMediaAsset(id: string, storagePath: string) {
  const supabase = createClient();
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) throw error;
}

export const MAX_VIDEO_FILE_SIZE_BYTES = 300 * 1024 * 1024; // 300MB
export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

export function validateVideoFile(file: File): string | null {
  const looksLikeVideo = file.type.startsWith("video/") || /\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(file.name);
  if (!looksLikeVideo) return "Please choose a video file (MP4, WebM, MOV, or OGG).";
  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    return `Video is too large — max ${MAX_VIDEO_FILE_SIZE_BYTES / (1024 * 1024)}MB, this file is ${Math.round(file.size / (1024 * 1024))}MB.`;
  }
  return null;
}

// uploadMediaAsset() never validated its input at all — any file type/size
// went straight to Storage, relying solely on the RLS admin gate. That's a
// legitimate boundary against outside attackers, but not against a stray
// multi-GB file or an accidentally-wrong file type reaching a picker that
// specifically asked for images. `accept` mirrors <MediaPickerField>'s own
// "image" | "any" prop so this enforces exactly what each call site already
// promises the admin, no stricter.
export const MAX_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function validateMediaFile(file: File, accept: "image" | "any" = "any"): string | null {
  if (accept === "image" && !file.type.startsWith("image/")) {
    return "Please choose an image file.";
  }
  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return `File is too large — max ${MAX_MEDIA_FILE_SIZE_BYTES / (1024 * 1024)}MB, this file is ${Math.round(file.size / (1024 * 1024))}MB.`;
  }
  return null;
}

/**
 * Same wire format as the supabase-js `storage.upload()` call inside
 * uploadMediaAsset() above (multipart POST to /storage/v1/object/{bucket}/{path}
 * with the session's bearer token), reimplemented over XMLHttpRequest instead
 * of fetch purely to get byte-level `upload.onprogress` events — fetch has no
 * browser-standard way to report upload progress, which the CMS video field
 * needs for large file uploads.
 */
export async function uploadMediaAssetWithProgress(
  file: File,
  onProgress: (percent: number) => void,
  folderId: string | null = null,
) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storagePath = `${crypto.randomUUID()}${ext}`;
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;

  await new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || "unknown error"}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      folder_id: folderId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || "video/mp4",
      kind: detectKind(file.type || "video/mp4"),
      file_size: file.size,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

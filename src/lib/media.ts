// Rulings 346 to 348: the client half of the one media pipeline. Every surface that uploads an
// image calls normalizeImage before any bytes leave the device, and reads through deliverImageUrl.
// The avatar control is the first consumer; the composer and the profile cover adopt these two
// functions next, so the conversion, the resize and the metadata strip live here once, not in each
// surface.
import { functionsUrl, getSupabase, SUPABASE_PUBLISHABLE_KEY } from "./supabase";

/** The two Supabase Storage buckets (ruling 1340: post-media and profile-media keep this path). */
export type StorageBucket = "profile-media" | "post-media";
/** Every bucket a public.media row may name; the third is Cloudflare R2 behind the app's own routes. */
export type MediaBucket = StorageBucket | "r2:message-media";
export type ImageFormat = "image/jpeg" | "image/webp";

/** The pipeline's shared ceilings. A normalised master is far under the 10 MB bucket limit. */
export const MEDIA_MAX_EDGE = 2000;
export const MEDIA_JPEG_QUALITY = 0.85;

export type NormalizedImage = {
  /** Re-encoded bytes: converted to `type`, downscaled to fit MEDIA_MAX_EDGE, metadata stripped. */
  blob: Blob;
  width: number;
  height: number;
  type: ImageFormat;
};

/**
 * Decode `file`, downscale it to fit within `maxEdge`, and re-encode it as JPEG (or WebP). Drawing to
 * a canvas and exporting through toBlob is what strips EXIF, XMP and GPS on the client (ruling 347):
 * the exported bytes carry no metadata from the source. Returns null when the browser cannot decode
 * the file (a HEIC on a build without the system codec, a corrupt file); the caller then uploads the
 * original and the server's own strip and validation stand as the backstop.
 */
export async function normalizeImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; format?: ImageFormat } = {},
): Promise<NormalizedImage | null> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return null;
  const maxEdge = opts.maxEdge ?? MEDIA_MAX_EDGE;
  const quality = opts.quality ?? MEDIA_JPEG_QUALITY;
  const type: ImageFormat = opts.format ?? "image/jpeg";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // JPEG has no alpha; paint white behind a transparent source so it does not composite to black.
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) return null;
    return { blob, width: w, height: h, type };
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/** The extension the pipeline stores for a normalised master. */
export function extensionFor(type: ImageFormat): "jpg" | "webp" {
  return type === "image/webp" ? "webp" : "jpg";
}

/** The bucket ceiling, applied to what actually leaves the device after normalisation. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Ruling 345: every upload is bounded in time. A stalled mobile connection resolves to the failed
 * state rather than a control that never comes back.
 */
export const IMAGE_UPLOAD_TIMEOUT_MS = 30_000;

export type ImageSlot = "avatar" | "cover";

export type ImageUpload =
  { ok: true; path: string; previewUrl: string } | { ok: false; reason: "too_large" | "failed" };

/**
 * Ruling 424 (W30) under 345 and 346: the one client half of the pipeline for every profile
 * image. Onboarding's photo and the profile's avatar and cover all call this: convert and
 * downscale on the device (normalizeImage), refuse a type the server would refuse, bound the
 * request to IMAGE_UPLOAD_TIMEOUT_MS, and hand back the master's storage path from media-upload,
 * the one write path. Too large and failed are told apart because each has its own alert.
 */
export async function uploadImage(file: File, slot: ImageSlot): Promise<ImageUpload> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "failed" };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: "failed" };

  // Convert and downscale before upload; on a decode failure fall back to the original bytes, which
  // the server's own strip and validation still stand behind.
  const normalized = await normalizeImage(file);
  const upload = normalized
    ? new File([normalized.blob], slot + "." + extensionFor(normalized.type), {
        type: normalized.type,
      })
    : file;
  if (upload.size > IMAGE_MAX_BYTES) return { ok: false, reason: "too_large" };

  const form = new FormData();
  form.append("file", upload);
  form.append("slot", slot);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(functionsUrl("media-upload"), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, apikey: SUPABASE_PUBLISHABLE_KEY },
      body: form,
      signal: controller.signal,
    });
    if (res.status === 413) return { ok: false, reason: "too_large" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const out = (await res.json()) as { storage_path?: string; error?: string };
    if (out.error === "too_large") return { ok: false, reason: "too_large" };
    return out.storage_path
      ? { ok: true, path: out.storage_path, previewUrl: URL.createObjectURL(upload) }
      : { ok: false, reason: "failed" };
  } catch {
    // A timeout abort, a network drop, a JSON parse failure: every rejection surfaces, never a
    // control left mid-upload (ruling 345).
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

export type Transform = {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
};

/** How long a signed storage URL lives, in seconds: the one lifetime every signing here asks for. */
export const SIGNED_URL_SECONDS = 60 * 60;
/**
 * W91 (Fix PR 10 item 6): a cache that keeps a signed URL re-signs it this many seconds before the
 * lifetime ends, so a tab left open never serves a token that has expired.
 */
export const SIGNED_URL_MARGIN_SECONDS = 5 * 60;

/**
 * A signed URL for a stored master, rendered at a delivery size (ruling 346: one master serves every
 * size). Falls back to the untransformed signed master if the transform cannot be produced, so a
 * caller always gets a URL. Private buckets require the signed variant; the transform rides on it.
 */
export async function deliverImageUrl(
  bucket: StorageBucket,
  path: string | null | undefined,
  transform?: Transform,
): Promise<string | undefined> {
  const sb = getSupabase();
  if (!sb || !path) return undefined;
  if (transform) {
    const { data } = await sb.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_SECONDS, { transform });
    if (data?.signedUrl) return data.signedUrl;
  }
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? undefined;
}

/**
 * H64-FEED1 (1920): every path signed in one createSignedUrls call, keyed by path; a path the caller
 * may not read is absent. The batch carries no transform (storage-js signs a transform one path at a
 * time), so this serves the untransformed masters a card frames itself.
 */
export async function signedUrls(
  bucket: StorageBucket,
  paths: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const sb = getSupabase();
  const unique = [...new Set([...paths].filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (!sb || !unique.length) return urls;
  const { data } = await sb.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_SECONDS);
  for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) urls.set(d.path, d.signedUrl);
  return urls;
}

/**
 * H64-FEED1 (1920): one delivery URL per distinct path at one transform, the signings in flight
 * together rather than awaited one after another. Keyed by path, undefined where deliverImageUrl
 * returned nothing.
 */
export async function deliverImageUrls(
  bucket: StorageBucket,
  paths: Iterable<string | null | undefined>,
  transform: Transform,
): Promise<Map<string, string | undefined>> {
  const unique = [...new Set([...paths].filter((p): p is string => !!p))];
  const urls = await Promise.all(unique.map((p) => deliverImageUrl(bucket, p, transform)));
  return new Map(unique.map((p, i) => [p, urls[i]]));
}

// ---------------------------------------------------------------------------------------------------
// Handoff 41-B (rulings 1346, 1374; 346, 347): the client half of Messenger media. The object lives on
// a private R2 bucket behind the app's own routes, so nothing here signs a URL and nothing reads the
// bucket directly: an upload is one POST of the bytes to /api/messages/media with the bearer, and a
// read is one GET of /api/messages/media/{id} with the bearer, turned into an object URL for <img>,
// <video> and <audio>. post-media and profile-media keep the Storage path above (1340).
// ---------------------------------------------------------------------------------------------------

/** The route's byte ceiling for every mime, mirrored from the server helper. */
export const MESSAGE_MEDIA_MAX_BYTES = 104857600;
/** Ten minutes, the bound on a voice note. */
export const MESSAGE_AUDIO_MAX_MS = 600000;
/**
 * Ruling 345: bounded in time, and longer than a profile image's bound because a 100 MB video on a
 * mobile connection is a different upload; a stall still resolves to the failed state.
 */
export const MESSAGE_MEDIA_UPLOAD_TIMEOUT_MS = 5 * 60_000;

export type MessageMediaMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/webm"
  | "video/quicktime"
  | "audio/webm"
  | "audio/mp4";

const MESSAGE_MEDIA_MIMES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/mp4",
];

/**
 * What the caller knows that the bytes do not. An image needs nothing (normalizeImage measures it);
 * a video carries its pixel size, read by the caller from a <video> attached to the document (H56-MOV:
 * a detached element is not measured here, so there is one measurement path and it is the caller's);
 * a voice note carries its duration from the recorder, which the route bounds at ten minutes.
 */
export type MessageMediaMeta =
  | { kind: "image" }
  | { kind: "video"; width?: number; height?: number }
  | { kind: "audio"; durationMs: number };

export type MessageMediaRefusal =
  "not_signed_in" | "not_a_member" | "bad_media" | "too_large" | "rate_limited" | "failed";

export type MessageMediaUpload =
  | {
      ok: true;
      mediaId: string;
      mime: MessageMediaMime;
      width: number | null;
      height: number | null;
      byteSize: number;
      /** An object URL of the bytes that were sent, for the composer's own preview. */
      previewUrl: string;
    }
  | { ok: false; reason: MessageMediaRefusal };

/** The route's path for one media object; the bytes still need the bearer, so see fetchMessageMedia. */
export function messageMediaUrl(mediaId: string): string {
  return "/api/messages/media/" + encodeURIComponent(mediaId);
}

async function bearer(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

function refusalWord(word: unknown, status: number): MessageMediaRefusal {
  if (
    word === "not_signed_in" ||
    word === "not_a_member" ||
    word === "bad_media" ||
    word === "too_large" ||
    word === "rate_limited"
  )
    return word;
  if (status === 401) return "not_signed_in";
  if (status === 403) return "not_a_member";
  if (status === 413) return "too_large";
  if (status === 429) return "rate_limited";
  return "failed";
}

/**
 * Upload one media object for a message in `thread`, keyed by the message's own `clientId` so a
 * retried send and its object stay together. Images go through normalizeImage first, unchanged
 * (346, 347): the route transforms nothing (1374), so an image the browser cannot decode is refused
 * here rather than sent with its metadata intact. A video's size is the caller's, and one over the
 * byte ceiling is too_large before anything else is asked of it (H56-MOV item 2).
 * The answer is the media id the client hands to messenger_send(..., 'media' | 'voice', ..., mediaId).
 */
export async function uploadMessageMedia(
  thread: string,
  clientId: string,
  file: File | Blob,
  meta: MessageMediaMeta,
): Promise<MessageMediaUpload> {
  const token = await bearer();
  if (!token) return { ok: false, reason: "not_signed_in" };

  let blob: Blob = file;
  let mime = (file.type || "").split(";")[0]!.trim().toLowerCase();
  const query = new URLSearchParams({ thread, client_id: clientId });

  if (meta.kind === "image") {
    if (!(file instanceof File)) return { ok: false, reason: "bad_media" };
    const normalized = await normalizeImage(file);
    if (!normalized) return { ok: false, reason: "bad_media" };
    blob = normalized.blob;
    mime = normalized.type;
    query.set("w", String(normalized.width));
    query.set("h", String(normalized.height));
  } else if (meta.kind === "video") {
    if (file.size > MESSAGE_MEDIA_MAX_BYTES) return { ok: false, reason: "too_large" };
    const { width, height } = meta;
    if (!width || !height || !Number.isInteger(width) || !Number.isInteger(height))
      return { ok: false, reason: "bad_media" };
    query.set("w", String(width));
    query.set("h", String(height));
  } else {
    if (!Number.isInteger(meta.durationMs) || meta.durationMs < 1)
      return { ok: false, reason: "bad_media" };
    if (meta.durationMs > MESSAGE_AUDIO_MAX_MS) return { ok: false, reason: "too_large" };
    query.set("duration_ms", String(meta.durationMs));
  }

  if (!MESSAGE_MEDIA_MIMES.includes(mime)) return { ok: false, reason: "bad_media" };
  if (blob.size < 1) return { ok: false, reason: "bad_media" };
  if (blob.size > MESSAGE_MEDIA_MAX_BYTES) return { ok: false, reason: "too_large" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MESSAGE_MEDIA_UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch("/api/messages/media?" + query.toString(), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": mime },
      body: blob,
      signal: controller.signal,
    });
    const out = (await res.json().catch(() => null)) as {
      media_id?: string;
      mime?: string;
      width?: number | null;
      height?: number | null;
      byte_size?: number;
      error?: string;
    } | null;
    if (!res.ok || !out || !out.media_id)
      return { ok: false, reason: refusalWord(out?.error, res.status) };
    return {
      ok: true,
      mediaId: out.media_id,
      mime: (out.mime ?? mime) as MessageMediaMime,
      width: out.width ?? null,
      height: out.height ?? null,
      byteSize: out.byte_size ?? blob.size,
      previewUrl: URL.createObjectURL(blob),
    };
  } catch {
    // A timeout abort, a network drop, a refused JSON: every rejection surfaces (ruling 345).
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The bytes of one media object, for an <img>, <video> or <audio> source made from them. The route
 * needs the bearer, which an element's own request cannot carry, so the fetch happens here; the
 * caller makes the object URL and revokes it when the element goes, and reads the mime from the
 * blob's own type (the route's Content-Type) rather than by fetching the object URL back, which
 * connect-src does not admit (ruling 1574). Null when signed out, refused, or absent.
 */
export async function fetchMessageMedia(mediaId: string): Promise<Blob | null> {
  const token = await bearer();
  if (!token) return null;
  try {
    const res = await fetch(messageMediaUrl(mediaId), {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

// media-upload: the one write path of the media pipeline (rulings 346 to 348).
//
// One master, one row, switchable optimisation. For a signed-in member it validates the file, strips
// EXIF and all metadata (ruling 347, unconditionally, independent of Tinify), stores a single master
// under a canonical path, records exactly one public.media row (ruling 346), then runs Tinify as a
// switchable compression pass the upload does not fail without. The master's pixels are never
// rewritten server-side: crop and focal point are recorded beside it and applied at delivery, so a
// future reframe (ruling 348) is a metadata write, never a re-upload. Delivery is a Storage image
// transformation on this one master, so it serves every size.
//
// multipart/form-data: file (image/jpeg | image/png | image/webp), then either
//   post_id (uuid minted by the composer): post-media, kind post, under {member}/{post}/{uuid}.{ext}
//   slot (avatar | cover): profile-media, that kind, under {member}/{uuid}.{ext}.
// Returns { storage_path, width, height, media_id }. The avatar control is the first consumer; the
// composer and the profile cover already flow through this same path.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const POST_BUCKET = "post-media";
const PROFILE_BUCKET = "profile-media";
const SLOTS = new Set(["avatar", "cover"]);
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Ruling 346: Tinify is a switchable step. Off, or on and failing, still yields a complete master.
const OPTIMIZE = (Deno.env.get("MEDIA_OPTIMIZE") ?? "on").toLowerCase() !== "off";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function sniff(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// Ruling 347: strip EXIF, XMP and every other metadata segment on the server, unconditionally. The
// strips are byte-level so the master's pixels are untouched (ruling 348); only non-pixel data goes.
// ---------------------------------------------------------------------------
function stripJpeg(b: Uint8Array): Uint8Array {
  // Keep SOI, drop APP1 (EXIF/XMP) and COM; copy every other segment verbatim, including the
  // entropy-coded scan after SOS. APP0/JFIF and APP2/ICC stay so colour is preserved.
  if (b.length < 2 || b[0] !== 0xff || b[1] !== 0xd8) return b;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) break;
    let marker = b[i + 1];
    // Skip fill bytes (0xFF runs).
    while (marker === 0xff && i + 2 < b.length) {
      i++;
      marker = b[i + 1];
    }
    // Standalone markers with no length payload.
    if (marker === 0xd9 /* EOI */) {
      out.push(0xff, marker);
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    if (i + 3 >= b.length) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) break;
    const segEnd = i + 2 + len;
    const drop = marker === 0xe1 || marker === 0xfe; // APP1, COM
    if (marker === 0xda /* SOS */) {
      // Copy SOS header, then the entropy data to EOI (or end) verbatim.
      for (let k = i; k < b.length; k++) out.push(b[k]);
      return Uint8Array.from(out);
    }
    if (!drop) for (let k = i; k < segEnd; k++) out.push(b[k]);
    i = segEnd;
  }
  return Uint8Array.from(out);
}

function stripPng(b: Uint8Array): Uint8Array {
  // Copy the 8-byte signature and every critical chunk; drop the metadata-bearing ancillary chunks.
  if (b.length < 8) return b;
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const out: number[] = [];
  for (let k = 0; k < 8; k++) out.push(b[k]);
  let i = 8;
  const td = new TextDecoder("latin1");
  while (i + 8 <= b.length) {
    const len = (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];
    const type = td.decode(b.subarray(i + 4, i + 8));
    const end = i + 12 + len; // length(4) + type(4) + data(len) + crc(4)
    if (len < 0 || end > b.length) break;
    if (!drop.has(type)) for (let k = i; k < end; k++) out.push(b[k]);
    i = end;
    if (type === "IEND") break;
  }
  return Uint8Array.from(out);
}

function stripWebp(b: Uint8Array): Uint8Array {
  // RIFF container: drop the EXIF and XMP chunks, rewrite the RIFF size. Leave image chunks alone.
  if (b.length < 12) return b;
  const td = new TextDecoder("latin1");
  const body: number[] = [];
  let i = 12; // after 'RIFF' size(4) 'WEBP'
  while (i + 8 <= b.length) {
    const fourcc = td.decode(b.subarray(i, i + 4));
    const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
    const padded = size + (size & 1);
    const end = i + 8 + padded;
    if (size < 0 || end > b.length) break;
    if (fourcc !== "EXIF" && fourcc !== "XMP ") for (let k = i; k < end; k++) body.push(b[k]);
    i = end;
  }
  const riffSize = 4 + body.length; // 'WEBP' + chunks
  const out = new Uint8Array(12 + body.length);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >> 24) & 0xff;
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  out.set(Uint8Array.from(body), 12);
  return out;
}

function stripMetadata(bytes: Uint8Array, type: string): Uint8Array {
  try {
    if (type === "image/jpeg") return stripJpeg(bytes);
    if (type === "image/png") return stripPng(bytes);
    if (type === "image/webp") return stripWebp(bytes);
  } catch (_e) {
    return bytes;
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Dimensions from the header, so the pipeline returns width and height with Tinify switched off.
// ---------------------------------------------------------------------------
function dimensions(b: Uint8Array, type: string): { width: number; height: number } | null {
  try {
    if (type === "image/png" && b.length >= 24)
      return {
        width: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19],
        height: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23],
      };
    if (type === "image/jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
        }
        if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = (b[i + 2] << 8) | b[i + 3];
        if (len < 2) break;
        i += 2 + len;
      }
      return null;
    }
    if (type === "image/webp" && b.length >= 30) {
      const td = new TextDecoder("latin1");
      const fourcc = td.decode(b.subarray(12, 16));
      if (fourcc === "VP8X")
        return {
          width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
          height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
        };
      if (fourcc === "VP8 ")
        return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
      if (fourcc === "VP8L") {
        const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
      }
    }
  } catch (_e) {
    return null;
  }
  return null;
}

const MAX_EDGE = 2000;

// The switchable pass. Always compresses; when maxEdge is set it also fits within that edge (scale
// down only) and reports the fitted dimensions. maxEdge is null for a surface whose client already
// normalised the master (the avatar); it is MAX_EDGE for a surface that has not adopted the client
// normalise yet (the composer and cover), preserving their prior behaviour until they migrate.
async function tinifyProcess(
  bytes: Uint8Array,
  apiKey: string,
  maxEdge: number | null,
): Promise<{ data: Uint8Array; width: number | null; height: number | null } | null> {
  const auth = "Basic " + btoa("api:" + apiKey);
  const shrink = await fetch("https://api.tinify.com/shrink", {
    method: "POST",
    headers: { Authorization: auth },
    body: bytes,
  });
  if (shrink.status !== 201) {
    console.log(JSON.stringify({ event: "tinify_shrink_failed", status: shrink.status }));
    return null;
  }
  const info = (await shrink.json()) as { output?: { url?: string } };
  const outUrl = shrink.headers.get("location") ?? info.output?.url;
  if (!outUrl) return null;
  const got =
    maxEdge === null
      ? await fetch(outUrl, { headers: { Authorization: auth } })
      : await fetch(outUrl, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({ resize: { method: "fit", width: maxEdge, height: maxEdge } }),
        });
  if (!got.ok) {
    console.log(JSON.stringify({ event: "tinify_fetch_failed", status: got.status }));
    return null;
  }
  const data = new Uint8Array(await got.arrayBuffer());
  const width = got.headers.get("image-width");
  const height = got.headers.get("image-height");
  return { data, width: width ? Number(width) : null, height: height ? Number(height) : null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // GET: operator health check behind the JWT. Reports whether optimisation is on and its key resolves.
  if (req.method === "GET")
    return json({ ok: true, optimize: OPTIMIZE, processor: !!Deno.env.get("TINIFY_API_KEY") });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tinifyKey = Deno.env.get("TINIFY_API_KEY");
  const authHeader = req.headers.get("authorization") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // Ruling 485: the server-side identity read is getClaims(), not getUser(). Where the token is
  // signed with an asymmetric key, getClaims verifies the signature against the JWKS cached in this
  // isolate and reads `sub` from the verified payload, so the upload path stops making a round trip
  // to the Auth server per request. It is never the weaker check: for a symmetric token, or where
  // WebCrypto is unavailable, getClaims calls getUser() itself before trusting a claim, so the floor
  // is exactly what this line did before. The token is passed explicitly because this client holds
  // the member's JWT as a request header and persists no session to read it back from.
  const bearer = authHeader.replace(/^\s*Bearer\s+/i, "").trim();
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(bearer);
  const uid = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (claimsErr || !uid) return json({ error: "unauthorized" }, 401);

  // Ruling 442 (F23): a ceiling per member on uploads, held in the database
  // (public.rate_limit_check, under the member's own JWT). The ceiling never reaches the client;
  // the refusal is a word the surfaces already turn into their failed alert.
  const { data: allowed, error: rateErr } = await userClient.rpc("rate_limit_check", {
    p_action: "media_upload",
  });
  if (rateErr) {
    console.log(JSON.stringify({ event: "rate_limit_unavailable", message: rateErr.message }));
    return json({ error: "rate_limit_unavailable" }, 503);
  }
  if (allowed !== true) return json({ error: "rate_limited" }, 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "bad_form" }, 400);
  }
  const file = form.get("file");
  const postId = String(form.get("post_id") ?? "");
  const slot = String(form.get("slot") ?? "");
  if (!(file instanceof File)) return json({ error: "no_file" }, 400);
  if (slot) {
    if (!SLOTS.has(slot)) return json({ error: "bad_slot" }, 400);
  } else if (!UUID.test(postId)) return json({ error: "bad_post_id" }, 400);
  if (file.size > MAX_INPUT_BYTES) return json({ error: "too_large" }, 413);

  // Handoff 64-WG (ruling 1854): the storage object and the media row below are written with the
  // service role, which no row policy reaches, so the launch gate is read here. A held member keeps
  // their own profile media (the avatar the Who screen asks for goes through the `slot` branch) and
  // writes no post media; the answer is onboarding_state's own `admitted`, read under the member's
  // JWT, the same read the client gate decides on (307).
  if (!slot) {
    const { data: state, error: stateErr } = await userClient.rpc("onboarding_state");
    if (stateErr) {
      console.log(JSON.stringify({ event: "admission_unavailable", message: stateErr.message }));
      return json({ error: "admission_unavailable" }, 503);
    }
    const admitted =
      state && typeof state === "object" && !Array.isArray(state)
        ? (state as { admitted?: unknown }).admitted === true
        : false;
    if (!admitted) return json({ error: "not_admitted" }, 403);
  }

  const original = new Uint8Array(await file.arrayBuffer());
  const type = sniff(original);
  if (!type || !ALLOWED[type]) return json({ error: "not_an_image" }, 415);

  // Ruling 347: strip on the server too, before anything else touches the bytes.
  let master = stripMetadata(original, type);
  const size = dimensions(master, type);
  if (!size || size.width <= 0 || size.height <= 0) return json({ error: "bad_image" }, 422);

  const ext = ALLOWED[type];
  const bucket = slot ? PROFILE_BUCKET : POST_BUCKET;
  const kind = slot || "post";
  const mediaId = crypto.randomUUID();
  const storagePath = slot ? `${uid}/${mediaId}.${ext}` : `${uid}/${postId}/${mediaId}.${ext}`;
  const admin = createClient(supabaseUrl, serviceKey);

  // Ruling 346: store the single master.
  const put = await admin.storage.from(bucket).upload(storagePath, master, {
    contentType: type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (put.error) {
    console.log(JSON.stringify({ event: "upload_failed", message: put.error.message }));
    return json({ error: "store_failed" }, 502);
  }

  // Ruling 346: record exactly one row for the master.
  const row = await admin
    .from("media")
    .insert({
      id: mediaId,
      owner_id: uid,
      bucket,
      storage_path: storagePath,
      kind,
      mime: type,
      width: size.width,
      height: size.height,
      byte_size: master.byteLength,
      optimized: false,
    })
    .select("id")
    .single();
  if (row.error) {
    console.log(JSON.stringify({ event: "media_row_failed", message: row.error.message }));
    // The master is orphaned without its row; remove it so a retry is clean, then report.
    await admin.storage.from(bucket).remove([storagePath]);
    return json({ error: "store_failed" }, 502);
  }

  // Ruling 346: the switchable optimisation. The upload has already succeeded; this only improves it.
  // The avatar arrives already normalised by the client, so it is compressed only; the composer and
  // cover have not adopted the client normalise yet, so the pass also fits them within MAX_EDGE,
  // exactly as before, until they migrate.
  let outWidth = size.width;
  let outHeight = size.height;
  if (OPTIMIZE && tinifyKey) {
    try {
      const maxEdge = kind === "avatar" ? null : MAX_EDGE;
      const processed = await tinifyProcess(master, tinifyKey, maxEdge);
      if (processed && processed.data.byteLength > 0) {
        const re = await admin.storage.from(bucket).upload(storagePath, processed.data, {
          contentType: type,
          cacheControl: "31536000",
          upsert: true,
        });
        if (!re.error) {
          master = processed.data;
          if (processed.width && processed.height) {
            outWidth = processed.width;
            outHeight = processed.height;
          }
          await admin
            .from("media")
            .update({
              optimized: true,
              byte_size: master.byteLength,
              width: outWidth,
              height: outHeight,
            })
            .eq("id", mediaId);
        }
      }
    } catch (e) {
      console.log(JSON.stringify({ event: "optimize_skipped", message: String(e).slice(0, 200) }));
    }
  }

  console.log(
    JSON.stringify({
      event: "media_uploaded",
      bucket,
      kind,
      bytes_in: original.byteLength,
      bytes_out: master.byteLength,
    }),
  );
  return json({ storage_path: storagePath, width: outWidth, height: outHeight, media_id: mediaId });
});

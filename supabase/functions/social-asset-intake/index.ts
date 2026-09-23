import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const BUCKET = "make-91ed8379-social-assets";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const CHANNELS = new Set(["instagram", "linkedin", "x"]);
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-nw-social-assets-token",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors },
  });
}

function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return json({ success: false, error: message, code }, status);
}

function ascii(bytes: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...bytes.slice(from, to));
}

function sniffImage(bytes: Uint8Array): { contentType: string; ext: string } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return { contentType: "image/png", ext: "png" };

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

function dimensions(bytes: Uint8Array, type: string): { width: number; height: number } | null {
  if (type === "image/png" && bytes.length >= 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }

  if (type === "image/jpeg") {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      while (i < bytes.length && bytes[i] === 0xff) i += 1;
      if (i >= bytes.length) break;
      const marker = bytes[i++];
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker === 0xda) break;
      if (i + 1 >= bytes.length) break;
      const len = (bytes[i] << 8) | bytes[i + 1];
      if (len < 2 || i + len > bytes.length) break;
      const sof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (sof && len >= 7) {
        return {
          height: (bytes[i + 3] << 8) | bytes[i + 4],
          width: (bytes[i + 5] << 8) | bytes[i + 6],
        };
      }
      i += len;
    }
    return null;
  }

  if (type === "image/webp" && bytes.length >= 30) {
    const chunk = ascii(bytes, 12, 16);
    if (chunk === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
  }
  return null;
}

function decodeBase64(input: string): Uint8Array {
  const comma = input.indexOf(",");
  const raw = input.startsWith("data:") && comma >= 0 ? input.slice(comma + 1) : input;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(raw)) throw new Error("imageBase64 is not valid base64.");
  const binary = atob(raw.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function slugify(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function safeKey(value: string) {
  const key = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
  if (key.length < 8) throw new Error("requestKey must contain at least 8 safe characters.");
  return key;
}

async function ensureBucket(supabase: ReturnType<typeof createClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Could not inspect storage buckets: ${listError.message}`);
  const exists = (buckets ?? []).some((b: { name: string }) => b.name === BUCKET);
  const config = {
    public: true,
    fileSizeLimit: "200MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime", "video/webm"],
  };
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, config);
    if (error && !/already exists/i.test(error.message)) throw new Error(`Could not create bucket: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return fail("POST only.", 405, "METHOD_NOT_ALLOWED");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRole) return fail("Server storage configuration is missing.", 500, "SERVER_CONFIG");

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("x-nw-social-assets-token") || "").trim();
  if (!token) return fail("Missing social-assets token.", 401, "UNAUTHORIZED");
  const { data: validToken, error: tokenError } = await supabase.rpc("verify_social_assets_token", { candidate: token });
  if (tokenError || validToken !== true) return fail("Invalid social-assets token.", 401, "UNAUTHORIZED");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON.", 400, "INVALID_JSON");
  }

  const channel = String(body.channel || "").toLowerCase();
  if (!CHANNELS.has(channel)) return fail("channel must be instagram, linkedin, or x.");

  let requestKey: string;
  try {
    requestKey = safeKey(String(body.requestKey || ""));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Invalid requestKey.");
  }

  const fileName = String(body.fileName || "asset").slice(0, 300);
  const caption = body.caption == null ? null : String(body.caption);
  const altText = body.altText == null ? null : String(body.altText);
  const notes = body.notes == null ? "" : String(body.notes);
  const source = String(body.source || "chatgpt-weekly-social-engine").slice(0, 60);

  if (caption && caption.length > 3000) return fail("caption exceeds 3000 characters.");
  if (altText && altText.length > 1000) return fail("altText exceeds 1000 characters.");
  if (notes.length > 1800) return fail("notes exceeds 1800 characters before bridge provenance is added.");

  const tagsRaw = Array.isArray(body.tags) ? body.tags : [];
  const tags = tagsRaw.map((x) => String(x).trim()).filter(Boolean);
  if (tags.length > 20 || tags.some((t) => t.length > 40)) return fail("tags must contain at most 20 values of 40 characters each.");

  const suppliedBase64 = typeof body.imageBase64 === "string" && body.imageBase64.length > 0;
  const suppliedUrl = typeof body.sourceUrl === "string" && body.sourceUrl.length > 0;
  if (suppliedBase64 === suppliedUrl) {
    return fail("Provide exactly one of imageBase64 or sourceUrl.");
  }

  let bytes: Uint8Array;
  let declaredType = String(body.contentType || "").split(";")[0].trim().toLowerCase();

  try {
    if (suppliedBase64) {
      bytes = decodeBase64(String(body.imageBase64));
    } else {
      const sourceUrl = new URL(String(body.sourceUrl));
      if (sourceUrl.protocol !== "https:") return fail("sourceUrl must use HTTPS.");
      const response = await fetch(sourceUrl.toString(), { redirect: "follow" });
      if (!response.ok) return fail(`Could not fetch sourceUrl: HTTP ${response.status}.`, 400, "SOURCE_FETCH_FAILED");
      bytes = new Uint8Array(await response.arrayBuffer());
      declaredType = declaredType || (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not decode/fetch image.", 400, "IMAGE_READ_FAILED");
  }

  if (bytes.length === 0) return fail("Image is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) return fail("Images must be 15MB or smaller.", 413, "IMAGE_TOO_LARGE");

  const sniffed = sniffImage(bytes);
  if (!sniffed) return fail("Unsupported image bytes. Use PNG, JPEG, or WebP.", 400, "UNSUPPORTED_IMAGE");
  if (declaredType && MIME_EXT[declaredType] && declaredType !== sniffed.contentType) {
    return fail(`Declared type ${declaredType} does not match image bytes ${sniffed.contentType}.`);
  }

  const actualDims = dimensions(bytes, sniffed.contentType);
  const width = body.width == null ? actualDims?.width ?? null : Number(body.width);
  const height = body.height == null ? actualDims?.height ?? null : Number(body.height);
  if ((width !== null && (!Number.isInteger(width) || width <= 0 || width > 20000)) ||
      (height !== null && (!Number.isInteger(height) || height <= 0 || height > 20000))) {
    return fail("width and height must be positive integers.");
  }
  if (actualDims && width && height && (actualDims.width !== width || actualDims.height !== height)) {
    return fail(`Declared dimensions ${width}x${height} do not match image bytes ${actualDims.width}x${actualDims.height}.`, 400, "DIMENSION_MISMATCH");
  }

  const expectedDims: Record<string, [number, number]> = {
    instagram: [1080, 1350],
    linkedin: [1200, 627],
    x: [1600, 900],
  };
  const [expectedW, expectedH] = expectedDims[channel];
  if (width && height && (width !== expectedW || height !== expectedH)) {
    return fail(`${channel} assets must be exactly ${expectedW}x${expectedH}; received ${width}x${height}.`, 400, "PLATFORM_DIMENSION_MISMATCH");
  }

  const storagePath = `channels/${channel}/bridge-${requestKey}__${slugify(fileName) || "asset"}.${sniffed.ext}`;

  const { data: existing, error: existingError } = await supabase
    .from("social_channel_assets")
    .select("*")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (existingError) return fail(`Could not check idempotency: ${existingError.message}`, 500, "LOOKUP_FAILED");
  if (existing) return json({ success: true, idempotent: true, data: existing }, 200);

  try {
    await ensureBucket(supabase);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not ensure storage bucket.", 500, "BUCKET_FAILED");
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: sniffed.contentType, upsert: true });
  if (uploadError) return fail(`Storage upload failed: ${uploadError.message}`, 500, "STORAGE_UPLOAD_FAILED");

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;
  const finalNotes = [notes.trim(), `request_key=${requestKey}`, "intake=connector-base64-bridge"].filter(Boolean).join("; ");

  const { data: inserted, error: insertError } = await supabase
    .from("social_channel_assets")
    .insert({
      channel,
      media_type: "image",
      storage_path: storagePath,
      url: publicUrl,
      file_name: fileName,
      content_type: sniffed.contentType,
      byte_size: bytes.length,
      width,
      height,
      duration_seconds: null,
      caption,
      alt_text: altText,
      tags,
      notes: finalNotes,
      status: "available",
      source,
      created_by: "chatgpt-connector-bridge",
      updated_by: "chatgpt-connector-bridge",
    })
    .select("*")
    .single();

  if (insertError) {
    const { data: raced } = await supabase
      .from("social_channel_assets")
      .select("*")
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (raced) return json({ success: true, idempotent: true, data: raced }, 200);
    return fail(`Could not register asset: ${insertError.message}`, 500, "ASSET_INSERT_FAILED");
  }

  return json({ success: true, idempotent: false, data: inserted }, 201);
});

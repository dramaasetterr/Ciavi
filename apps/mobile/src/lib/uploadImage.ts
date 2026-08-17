import * as ImageManipulator from "expo-image-manipulator";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { supabase } from "./supabase";

// Max long-edge for uploaded photos. 1568px is the sweet spot for AI vision
// analysis; larger only adds upload time and token cost.
const MAX_IMAGE_WIDTH = 1568;
const JPEG_QUALITY = 0.8;

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// RN's Blob can't be serialized by supabase-js (uploads end up 0 bytes),
// so uploads must go through base64 → ArrayBuffer.
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c2 = BASE64_CHARS.indexOf(clean[i + 2]);
    const c3 = BASE64_CHARS.indexOf(clean[i + 3]);
    bytes[byteIndex++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) bytes[byteIndex++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 >= 0) bytes[byteIndex++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, byteIndex);
}

/**
 * Re-encode any picked image (HEIC included) as a resized JPEG.
 * Returns a local file URI pointing at the converted image.
 */
export async function prepareImageForUpload(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Upload a local file to Supabase Storage and return its public URL.
 * Throws on failure (callers decide whether a failed upload is fatal).
 */
export async function uploadFileToStorage(
  bucket: string,
  path: string,
  localUri: string,
  contentType: string,
  options?: { upsert?: boolean }
): Promise<string> {
  const base64 = await readAsStringAsync(localUri, {
    encoding: EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength === 0) {
    throw new Error(`Read 0 bytes from ${localUri}`);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes.buffer as ArrayBuffer, {
      contentType,
      upsert: options?.upsert ?? false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("No public URL returned");
  return data.publicUrl;
}

/**
 * Convert a picked photo to an upload-ready JPEG and push it to storage.
 * Returns the public URL.
 */
export async function uploadPhoto(
  bucket: string,
  path: string,
  pickedUri: string
): Promise<string> {
  const jpegUri = await prepareImageForUpload(pickedUri);
  return uploadFileToStorage(bucket, path, jpegUri, "image/jpeg");
}

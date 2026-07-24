const MAX_DIMENSION = 1920;
const QUALITY = 0.8;
// Recompressing an already-small file isn't worth the quality loss.
const SKIP_BELOW_BYTES = 300 * 1024;

/**
 * Resizes/re-encodes an image in the browser before it's uploaded. Phone
 * camera photos are routinely 8-20MB — well past Vercel's hard, non-
 * configurable 4.5MB request-body limit for serverless functions — so this
 * has to happen before the network request, not just server-side after.
 *
 * GIFs pass through untouched (canvas would flatten an animated GIF to its
 * first frame). PNG/WebP inputs stay PNG/WebP so transparency (e.g. a
 * screenshotted payment QR) survives; anything else becomes JPEG. Falls
 * back to the original file on any decode/encode failure rather than
 * blocking the upload.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size < SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType =
      file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name, { type: outputType });
  } catch {
    return file;
  }
}

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1920;

// Shrinks large photos (phone camera receipts, etc.) before they hit
// storage. GIFs are passed through untouched — sharp would flatten an
// animated GIF to its first frame, which isn't what a QR/receipt upload
// wants. If sharp can't decode the buffer, fall back to the original bytes
// rather than fail the whole upload over a compression step.
async function compressImage(bytes: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "image/gif") {
    return bytes;
  }

  try {
    const resized = sharp(bytes)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });

    switch (mimeType) {
      case "image/jpeg":
        return await resized.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      case "image/png":
        return await resized.png({ compressionLevel: 9 }).toBuffer();
      case "image/webp":
        return await resized.webp({ quality: 80 }).toBuffer();
      default:
        return bytes;
    }
  } catch {
    return bytes;
  }
}

// The browser-supplied Content-Type is attacker-controlled — verify the
// actual file bytes match a real image signature before trusting the
// declared type, so someone can't upload arbitrary content (e.g. HTML/SVG
// with a script) mislabeled as an image and have it served back publicly
// from /uploads/.
function matchesImageSignature(mimeType: string, bytes: Buffer): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "image/gif":
      return (
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
      );
    case "image/webp":
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesImageSignature(file.type, bytes)) {
    return NextResponse.json({ error: "File content doesn't match its declared image type." }, { status: 400 });
  }

  const compressed = await compressImage(bytes, file.type);

  if (isCloudinaryConfigured) {
    try {
      const url = await uploadToCloudinary(compressed);
      return NextResponse.json({ url });
    } catch {
      return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
    }
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadsDir, filename), compressed);

  return NextResponse.json({ url: `/uploads/${filename}` });
}

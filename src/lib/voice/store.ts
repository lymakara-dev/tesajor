/**
 * Storage for server-generated voice clips — same backends as user
 * uploads: Cloudinary when configured, ./public/uploads on local disk
 * otherwise. Server-only (called from the voice action after synthesis;
 * the bytes come from the TTS provider, never from a user).
 */
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { isCloudinaryConfigured, uploadAudioToCloudinary } from "@/lib/cloudinary";

export async function storeVoiceClip(bytes: Buffer): Promise<string> {
  if (isCloudinaryConfigured) {
    return uploadAudioToCloudinary(bytes);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.mp3`;
  await writeFile(path.join(uploadsDir, filename), bytes);
  return `/uploads/${filename}`;
}

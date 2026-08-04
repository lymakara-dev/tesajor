import { z } from "zod";

/**
 * The app is served over HTTPS, so the music server must be too (browsers
 * block mixed-content audio). Plain http is allowed only for localhost dev.
 */
const serverUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine(
    (url) =>
      url.startsWith("https://") ||
      /^http:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(url),
    { message: "Server URL must use https:// (http is only allowed for localhost)." },
  );

export const linkMusicAccountSchema = z.object({
  serverUrl: serverUrlSchema,
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
});

const provinceCodeSchema = z.string().regex(/^KH-\d{1,2}$/, "Invalid province code.");

export const setProvincePlaylistSchema = z.object({
  provinceCode: provinceCodeSchema,
  playlistId: z.string().trim().min(1).max(200),
  playlistName: z.string().trim().min(1).max(300),
});

export const clearProvincePlaylistSchema = z.object({
  provinceCode: provinceCodeSchema,
});

export const getMusicSuggestionSchema = z.object({
  provinceCode: provinceCodeSchema,
});

export const getPlaylistQueueSchema = z.object({
  playlistId: z.string().trim().min(1).max(200),
});

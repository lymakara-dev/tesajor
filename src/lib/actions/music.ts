"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { musicAccounts, provincePlaylists } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { provinceByCode } from "@/lib/geo/provinces";
import {
  coverArtUrl,
  getPlaylists,
  getPlaylistSongs,
  makeSubsonicAuth,
  streamUrl,
  subsonicPing,
  type SubsonicCredentials,
  type SubsonicPlaylist,
} from "@/lib/music/subsonic";
import { suggestPlaylist, type PlaylistSuggestion } from "@/lib/music/suggest";
import {
  clearProvincePlaylistSchema,
  getMusicSuggestionSchema,
  getPlaylistQueueSchema,
  linkMusicAccountSchema,
  setProvincePlaylistSchema,
} from "@/lib/validation/music";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** A queue entry ready for the mini-player's `<audio>` element. */
export interface QueueSong {
  id: string;
  title: string;
  artist: string | null;
  durationSec: number | null;
  streamUrl: string;
  coverArtUrl: string | null;
}

const UNREACHABLE = "Couldn't reach your music server — check the URL and try again.";

async function credentialsFor(userId: string): Promise<SubsonicCredentials | null> {
  const [account] = await db
    .select()
    .from(musicAccounts)
    .where(eq(musicAccounts.userId, userId))
    .limit(1);
  if (!account) return null;
  return {
    serverUrl: account.serverUrl,
    username: account.username,
    salt: account.subsonicSalt,
    token: account.subsonicToken,
  };
}

/**
 * Link a Navidrome/Subsonic account: verify the credentials against
 * /rest/ping, then store only the salt + md5 token — never the password
 * (ADR-0008). Rate-limited so this can't be used to probe third-party
 * servers from our IP.
 */
export async function linkMusicAccount(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = linkMusicAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid music server." };
  }
  if (!checkRateLimit(`music-link:${session.user.id}`, 5, 5 * 60 * 1000)) {
    return { ok: false, error: "Too many attempts — try again in a few minutes." };
  }

  const { serverUrl, username, password } = parsed.data;
  const { salt, token } = makeSubsonicAuth(password);
  const creds: SubsonicCredentials = { serverUrl, username, salt, token };

  if (!(await subsonicPing(creds))) {
    return { ok: false, error: "Couldn't sign in to the music server — check the URL, username and password." };
  }

  await db
    .insert(musicAccounts)
    .values({
      userId: session.user.id,
      serverUrl,
      username,
      subsonicSalt: salt,
      subsonicToken: token,
    })
    .onConflictDoUpdate({
      target: musicAccounts.userId,
      set: {
        serverUrl,
        username,
        subsonicSalt: salt,
        subsonicToken: token,
        linkedAt: new Date(),
      },
    });

  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/** Unlink the music server and drop the province mappings that go with it. */
export async function unlinkMusicAccount(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  await db.transaction(async (tx) => {
    await tx.delete(provincePlaylists).where(eq(provincePlaylists.userId, session.user.id));
    await tx.delete(musicAccounts).where(eq(musicAccounts.userId, session.user.id));
  });

  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/** The linked account's playlists — used by the province-mapping screen. */
export async function getMyPlaylists(): Promise<ActionResult<{ playlists: SubsonicPlaylist[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const creds = await credentialsFor(session.user.id);
  if (!creds) return { ok: false, error: "No music server linked." };

  try {
    return { ok: true, data: { playlists: await getPlaylists(creds) } };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

export async function setProvincePlaylist(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = setProvincePlaylistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid mapping." };
  }
  if (!provinceByCode(parsed.data.provinceCode)) {
    return { ok: false, error: "Unknown province." };
  }

  await db
    .insert(provincePlaylists)
    .values({ userId: session.user.id, ...parsed.data })
    .onConflictDoUpdate({
      target: [provincePlaylists.userId, provincePlaylists.provinceCode],
      set: { playlistId: parsed.data.playlistId, playlistName: parsed.data.playlistName },
    });

  revalidatePath("/account");
  return { ok: true, data: undefined };
}

export async function clearProvincePlaylist(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = clearProvincePlaylistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid province." };
  }

  await db
    .delete(provincePlaylists)
    .where(
      and(
        eq(provincePlaylists.userId, session.user.id),
        eq(provincePlaylists.provinceCode, parsed.data.provinceCode),
      ),
    );

  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/**
 * Playlist suggestion for a province: explicit mapping first, then a
 * playlist-name match (km or en), else null. Pure logic lives in
 * src/lib/music/suggest.ts; this action only assembles its inputs.
 */
export async function getMusicSuggestion(
  input: unknown,
): Promise<ActionResult<{ suggestion: PlaylistSuggestion | null }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = getMusicSuggestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid province." };
  }
  const province = provinceByCode(parsed.data.provinceCode);
  if (!province) return { ok: false, error: "Unknown province." };

  const creds = await credentialsFor(session.user.id);
  if (!creds) return { ok: false, error: "No music server linked." };

  const mappings = await db
    .select()
    .from(provincePlaylists)
    .where(eq(provincePlaylists.userId, session.user.id));

  // Rule 1 needs no server round trip; only fall through to fetching the
  // playlist list when there's no explicit mapping to name-match against.
  const mapped = suggestPlaylist(province, mappings, []);
  if (mapped) return { ok: true, data: { suggestion: mapped } };

  try {
    const playlists = await getPlaylists(creds);
    return { ok: true, data: { suggestion: suggestPlaylist(province, mappings, playlists) } };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

/** The songs of a playlist as ready-to-play queue entries. */
export async function getPlaylistQueue(
  input: unknown,
): Promise<ActionResult<{ songs: QueueSong[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = getPlaylistQueueSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid playlist." };
  }

  const creds = await credentialsFor(session.user.id);
  if (!creds) return { ok: false, error: "No music server linked." };

  try {
    const songs = await getPlaylistSongs(creds, parsed.data.playlistId);
    return {
      ok: true,
      data: {
        songs: songs.map((song) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          durationSec: song.durationSec,
          // The phone streams straight from the music server — our server
          // never proxies audio bytes.
          streamUrl: streamUrl(creds, song.id),
          coverArtUrl: song.coverArt ? coverArtUrl(creds, song.coverArt) : null,
        })),
      },
    };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

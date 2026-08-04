/**
 * Thin typed client for a Subsonic-compatible music server (Navidrome).
 *
 * Auth follows the Subsonic token scheme: the server stores a random salt
 * and `token = md5(password + salt)` — never the password (ADR-0008). URL
 * and parameter construction is pure and unit-tested; the fetchers below it
 * are thin wrappers.
 *
 * Integration is HTTP-API-only: no Navidrome (GPL-3.0) code is linked, so
 * the MIT/Apache-only dependency rule is untouched.
 */
import { createHash, randomBytes } from "crypto";

/** What the app stores per linked account (see `music_accounts`). */
export interface SubsonicCredentials {
  serverUrl: string;
  username: string;
  salt: string;
  token: string;
}

export interface SubsonicPlaylist {
  id: string;
  name: string;
  songCount: number;
  durationSec: number;
  coverArt: string | null;
}

export interface SubsonicSong {
  id: string;
  title: string;
  artist: string | null;
  durationSec: number | null;
  coverArt: string | null;
}

const API_VERSION = "1.16.1";
const CLIENT_NAME = "tesajor";

/** md5 hex digest — Subsonic's token scheme predates modern hashes. */
function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * Derive the stored auth pair from a password. `salt` is injectable for
 * tests; callers omit it and get a fresh random one.
 */
export function makeSubsonicAuth(
  password: string,
  salt: string = randomBytes(8).toString("hex"),
): { salt: string; token: string } {
  return { salt, token: md5(password + salt) };
}

/**
 * Build a full Subsonic REST URL, e.g. `subsonicUrl(creds, "getPlaylists")`.
 * Handles trailing slashes on the server URL and encodes every param.
 */
export function subsonicUrl(
  creds: SubsonicCredentials,
  endpoint: string,
  extraParams: Record<string, string> = {},
): string {
  const base = creds.serverUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    u: creds.username,
    t: creds.token,
    s: creds.salt,
    v: API_VERSION,
    c: CLIENT_NAME,
    f: "json",
    ...extraParams,
  });
  return `${base}/rest/${endpoint}?${params.toString()}`;
}

/** Direct-stream URL for an `<audio>` element — the phone streams straight
 * from the music server; our server never proxies audio bytes. */
export function streamUrl(creds: SubsonicCredentials, songId: string): string {
  return subsonicUrl(creds, "stream", { id: songId });
}

export function coverArtUrl(creds: SubsonicCredentials, coverArtId: string): string {
  return subsonicUrl(creds, "getCoverArt", { id: coverArtId, size: "300" });
}

/* ------------------------------------------------------------------ */
/* Response parsing (pure, tested)                                     */
/* ------------------------------------------------------------------ */

interface SubsonicEnvelope {
  "subsonic-response"?: {
    status?: string;
    error?: { code?: number; message?: string };
    playlists?: { playlist?: unknown[] };
    playlist?: { entry?: unknown[] };
  };
}

/** Unwrap the `subsonic-response` envelope; throw on `status: "failed"`. */
export function unwrapSubsonicResponse(
  json: unknown,
): NonNullable<SubsonicEnvelope["subsonic-response"]> {
  const body = (json as SubsonicEnvelope)?.["subsonic-response"];
  if (!body) throw new Error("Not a Subsonic response");
  if (body.status !== "ok") {
    throw new Error(body.error?.message ?? "Subsonic request failed");
  }
  return body;
}

function asPlaylist(raw: unknown): SubsonicPlaylist {
  const p = raw as Record<string, unknown>;
  return {
    id: String(p.id),
    name: typeof p.name === "string" ? p.name : "",
    songCount: typeof p.songCount === "number" ? p.songCount : 0,
    durationSec: typeof p.duration === "number" ? p.duration : 0,
    coverArt: typeof p.coverArt === "string" ? p.coverArt : null,
  };
}

function asSong(raw: unknown): SubsonicSong {
  const s = raw as Record<string, unknown>;
  return {
    id: String(s.id),
    title: typeof s.title === "string" ? s.title : "",
    artist: typeof s.artist === "string" ? s.artist : null,
    durationSec: typeof s.duration === "number" ? s.duration : null,
    coverArt: typeof s.coverArt === "string" ? s.coverArt : null,
  };
}

export function parsePlaylists(json: unknown): SubsonicPlaylist[] {
  const body = unwrapSubsonicResponse(json);
  return (body.playlists?.playlist ?? []).map(asPlaylist);
}

export function parsePlaylistSongs(json: unknown): SubsonicSong[] {
  const body = unwrapSubsonicResponse(json);
  return (body.playlist?.entry ?? []).map(asSong);
}

/* ------------------------------------------------------------------ */
/* Fetchers (thin, not unit-tested — logic lives above)                */
/* ------------------------------------------------------------------ */

const FETCH_TIMEOUT_MS = 8_000;

async function subsonicFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Music server returned ${res.status}`);
  return res.json();
}

/** True if the credentials work against the server. */
export async function subsonicPing(creds: SubsonicCredentials): Promise<boolean> {
  try {
    unwrapSubsonicResponse(await subsonicFetch(subsonicUrl(creds, "ping")));
    return true;
  } catch {
    return false;
  }
}

export async function getPlaylists(creds: SubsonicCredentials): Promise<SubsonicPlaylist[]> {
  return parsePlaylists(await subsonicFetch(subsonicUrl(creds, "getPlaylists")));
}

export async function getPlaylistSongs(
  creds: SubsonicCredentials,
  playlistId: string,
): Promise<SubsonicSong[]> {
  return parsePlaylistSongs(
    await subsonicFetch(subsonicUrl(creds, "getPlaylist", { id: playlistId })),
  );
}

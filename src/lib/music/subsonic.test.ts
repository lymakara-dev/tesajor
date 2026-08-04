import { describe, expect, it } from "vitest";
import {
  coverArtUrl,
  makeSubsonicAuth,
  parsePlaylistSongs,
  parsePlaylists,
  streamUrl,
  subsonicUrl,
  unwrapSubsonicResponse,
  type SubsonicCredentials,
} from "./subsonic";

const creds: SubsonicCredentials = {
  serverUrl: "https://music.example.com",
  username: "makara",
  salt: "c19b2d",
  token: "26719a1196d2a940705a59634eb18eab",
};

describe("makeSubsonicAuth", () => {
  it("computes token = md5(password + salt) — Subsonic docs example", () => {
    // From the Subsonic API docs: password "sesame", salt "c19b2d".
    expect(makeSubsonicAuth("sesame", "c19b2d")).toEqual({
      salt: "c19b2d",
      token: "26719a1196d2a940705a59634eb18eab",
    });
  });

  it("generates a random hex salt and 32-char hex token when salt is omitted", () => {
    const a = makeSubsonicAuth("sesame");
    const b = makeSubsonicAuth("sesame");
    expect(a.salt).toMatch(/^[0-9a-f]{16}$/);
    expect(a.token).toMatch(/^[0-9a-f]{32}$/);
    expect(a.salt).not.toBe(b.salt);
    expect(a.token).not.toBe(b.token);
  });
});

describe("subsonicUrl", () => {
  it("includes the full auth parameter set", () => {
    const url = new URL(subsonicUrl(creds, "ping"));
    expect(url.origin + url.pathname).toBe("https://music.example.com/rest/ping");
    expect(url.searchParams.get("u")).toBe("makara");
    expect(url.searchParams.get("t")).toBe(creds.token);
    expect(url.searchParams.get("s")).toBe("c19b2d");
    expect(url.searchParams.get("v")).toBe("1.16.1");
    expect(url.searchParams.get("c")).toBe("tesajor");
    expect(url.searchParams.get("f")).toBe("json");
  });

  it("strips trailing slashes from the server URL", () => {
    const url = subsonicUrl({ ...creds, serverUrl: "https://music.example.com/" }, "ping");
    expect(url).toContain("https://music.example.com/rest/ping?");
  });

  it("encodes extra params and usernames with special characters", () => {
    const url = new URL(
      subsonicUrl({ ...creds, username: "me@home" }, "getPlaylist", { id: "a b&c" }),
    );
    expect(url.searchParams.get("u")).toBe("me@home");
    expect(url.searchParams.get("id")).toBe("a b&c");
  });
});

describe("streamUrl / coverArtUrl", () => {
  it("builds a stream URL for a song id", () => {
    const url = new URL(streamUrl(creds, "song-42"));
    expect(url.pathname).toBe("/rest/stream");
    expect(url.searchParams.get("id")).toBe("song-42");
  });

  it("builds a sized cover-art URL", () => {
    const url = new URL(coverArtUrl(creds, "cover-7"));
    expect(url.pathname).toBe("/rest/getCoverArt");
    expect(url.searchParams.get("id")).toBe("cover-7");
    expect(url.searchParams.get("size")).toBe("300");
  });
});

describe("unwrapSubsonicResponse", () => {
  it("returns the body when status is ok", () => {
    const body = unwrapSubsonicResponse({ "subsonic-response": { status: "ok" } });
    expect(body.status).toBe("ok");
  });

  it("throws the server's error message on failure", () => {
    expect(() =>
      unwrapSubsonicResponse({
        "subsonic-response": {
          status: "failed",
          error: { code: 40, message: "Wrong username or password" },
        },
      }),
    ).toThrow("Wrong username or password");
  });

  it("throws on a non-Subsonic payload", () => {
    expect(() => unwrapSubsonicResponse({ hello: "world" })).toThrow("Not a Subsonic response");
  });
});

describe("parsePlaylists", () => {
  it("maps a Navidrome getPlaylists response", () => {
    const playlists = parsePlaylists({
      "subsonic-response": {
        status: "ok",
        playlists: {
          playlist: [
            { id: "pl-1", name: "កំពត vibes", songCount: 12, duration: 2900, coverArt: "pl-1" },
            { id: "pl-2", name: "Road trip" },
          ],
        },
      },
    });
    expect(playlists).toEqual([
      { id: "pl-1", name: "កំពត vibes", songCount: 12, durationSec: 2900, coverArt: "pl-1" },
      { id: "pl-2", name: "Road trip", songCount: 0, durationSec: 0, coverArt: null },
    ]);
  });

  it("returns [] when the user has no playlists", () => {
    expect(
      parsePlaylists({ "subsonic-response": { status: "ok", playlists: {} } }),
    ).toEqual([]);
  });
});

describe("parsePlaylistSongs", () => {
  it("maps playlist entries to songs", () => {
    const songs = parsePlaylistSongs({
      "subsonic-response": {
        status: "ok",
        playlist: {
          entry: [
            { id: "s-1", title: "បទល្បី", artist: "Sin Sisamouth", duration: 210, coverArt: "c1" },
            { id: "s-2", title: "Untitled" },
          ],
        },
      },
    });
    expect(songs).toEqual([
      { id: "s-1", title: "បទល្បី", artist: "Sin Sisamouth", durationSec: 210, coverArt: "c1" },
      { id: "s-2", title: "Untitled", artist: null, durationSec: null, coverArt: null },
    ]);
  });
});

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  getMusicSuggestion,
  getPlaylistQueue,
  type QueueSong,
} from "@/lib/actions/music";
import type { PlaylistSuggestion } from "@/lib/music/suggest";
import { MiniPlayer } from "@/components/mini-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Play } from "lucide-react";

interface Props {
  /** ISO 3166-2:KH code of the dominant province of the day's stops. */
  provinceCode: string;
  /** Locale-appropriate province display name (resolved server-side). */
  provinceName: string;
}

/**
 * "You're heading to Kampot — play កំពត vibes?" Only rendered when the user
 * has a linked music account and the trip resolves to a province; the
 * suggestion itself is fetched lazily so the trip page never waits on the
 * music server.
 */
export function TripMusicCard({ provinceCode, provinceName }: Props) {
  const t = useTranslations("music");
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "none" }
    | { kind: "suggested"; suggestion: PlaylistSuggestion }
  >({ kind: "loading" });
  const [queue, setQueue] = useState<{ playlistName: string; songs: QueueSong[] } | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await getMusicSuggestion({ provinceCode });
    if (!result.ok) {
      setState({ kind: "error" });
      return;
    }
    setState(
      result.data.suggestion
        ? { kind: "suggested", suggestion: result.data.suggestion }
        : { kind: "none" },
    );
  }, [provinceCode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function play(suggestion: PlaylistSuggestion) {
    setLoadingQueue(true);
    setQueueError(null);
    const result = await getPlaylistQueue({ playlistId: suggestion.playlistId });
    setLoadingQueue(false);
    if (!result.ok) {
      setQueueError(result.error);
      return;
    }
    if (result.data.songs.length === 0) {
      setQueueError(t("emptyPlaylist"));
      return;
    }
    setQueue({ playlistName: suggestion.playlistName, songs: result.data.songs });
  }

  if (state.kind === "loading") return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="size-4 text-mekong" strokeWidth={1.5} />
            {t("cardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.kind === "error" && (
            <>
              <p className="text-sm text-muted-foreground">{t("unreachable")}</p>
              <Button variant="outline" size="sm" onClick={load}>
                {t("retry")}
              </Button>
            </>
          )}
          {state.kind === "none" && (
            <p className="text-sm text-muted-foreground">
              {t("noPlaylist", { province: provinceName })}{" "}
              <Link href="/account" className="underline underline-offset-2">
                {t("mapProvinces")}
              </Link>
            </p>
          )}
          {state.kind === "suggested" && (
            <>
              <p className="text-sm text-muted-foreground" data-testid="music-suggestion">
                {t("suggestion", {
                  province: provinceName,
                  playlist: state.suggestion.playlistName,
                })}
              </p>
              <Button
                size="sm"
                data-testid="music-play"
                onClick={() => play(state.suggestion)}
                disabled={loadingQueue}
              >
                <Play className="size-4" strokeWidth={1.5} />
                {loadingQueue ? t("loading") : t("playButton")}
              </Button>
              {queueError && <p className="text-sm text-destructive">{queueError}</p>}
            </>
          )}
        </CardContent>
      </Card>
      {queue && (
        <MiniPlayer
          playlistName={queue.playlistName}
          songs={queue.songs}
          onClose={() => setQueue(null)}
        />
      )}
    </>
  );
}

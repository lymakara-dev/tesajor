"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { QueueSong } from "@/lib/actions/music";
import { Button } from "@/components/ui/button";
import { Music, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";

interface Props {
  playlistName: string;
  songs: QueueSong[];
  onClose: () => void;
}

/**
 * Bottom-bar audio player. The `<audio>` element streams straight from the
 * user's music server (Subsonic /rest/stream URL) — no audio bytes pass
 * through our server. Sits above the mobile tab bar.
 */
export function MiniPlayer({ playlistName, songs, onClose }: Props) {
  const t = useTranslations("music");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const song = songs[index];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      // play() can reject (e.g. the server became unreachable mid-queue);
      // surface that as "paused" instead of an unhandled rejection.
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, index]);

  if (!song) return null;

  function next() {
    if (index < songs.length - 1) setIndex(index + 1);
    else onClose();
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4 sm:bottom-4">
      <div
        className="elevation-8-top mx-auto flex max-w-[480px] items-center gap-3 rounded-xl border border-sandstone bg-background p-3"
        data-testid="mini-player"
      >
        <audio ref={audioRef} src={song.streamUrl} onEnded={next} autoPlay />
        {song.coverArtUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote art from the user's own server, unknown domain
          <img
            src={song.coverArtUrl}
            alt=""
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Music className="size-4 text-mekong" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{song.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {song.artist ?? playlistName}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("previous")}
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <SkipBack className="size-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={playing ? t("pause") : t("play")}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <Pause className="size-4" strokeWidth={1.5} />
          ) : (
            <Play className="size-4" strokeWidth={1.5} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("next")}
          disabled={index === songs.length - 1}
          onClick={next}
        >
          <SkipForward className="size-4" strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("close")} onClick={onClose}>
          <X className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}

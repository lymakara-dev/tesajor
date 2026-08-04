"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { QueueSong } from "@/lib/actions/music";
import { MiniPlayer } from "@/components/mini-player";

interface MusicPlayerContextValue {
  play: (playlistName: string, songs: QueueSong[]) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue>({
  play: () => {},
});

export function useMusicPlayer(): MusicPlayerContextValue {
  return useContext(MusicPlayerContext);
}

/**
 * Root-layout home for the mini-player, so playback survives navigating
 * between pages (the root layout never remounts on route changes). Pages
 * start a queue via `useMusicPlayer().play(...)`; the `<audio>` element
 * lives in MiniPlayer and streams directly from the user's music server.
 */
export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<{ playlistName: string; songs: QueueSong[] } | null>(null);

  const play = useCallback((playlistName: string, songs: QueueSong[]) => {
    setQueue({ playlistName, songs });
  }, []);

  return (
    <MusicPlayerContext.Provider value={{ play }}>
      {children}
      {queue && (
        <MiniPlayer
          // Restart playback state when a different playlist is chosen.
          key={queue.playlistName}
          playlistName={queue.playlistName}
          songs={queue.songs}
          onClose={() => setQueue(null)}
        />
      )}
    </MusicPlayerContext.Provider>
  );
}

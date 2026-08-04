"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  clearProvincePlaylist,
  getMyPlaylists,
  linkMusicAccount,
  setProvincePlaylist,
  unlinkMusicAccount,
} from "@/lib/actions/music";
import type { SubsonicPlaylist } from "@/lib/music/subsonic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Music, X } from "lucide-react";

export interface ProvinceOption {
  code: string;
  nameEn: string;
  nameKm: string;
}

export interface ProvinceMappingRow {
  provinceCode: string;
  playlistId: string;
  playlistName: string;
}

interface Props {
  linked: boolean;
  serverUrl: string | null;
  username: string | null;
  provinces: ProvinceOption[];
  mappings: ProvinceMappingRow[];
}

/**
 * /account "Music server" section: link a Navidrome/Subsonic server (the
 * password is verified against /rest/ping and never stored — ADR-0008),
 * and map provinces to playlists for the trip-day suggestion card.
 */
export function MusicServerCard({ linked, serverUrl, username, provinces, mappings }: Props) {
  const t = useTranslations("music");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mapping form state — playlists load lazily on first open.
  const [playlists, setPlaylists] = useState<SubsonicPlaylist[] | null>(null);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [provinceCode, setProvinceCode] = useState("");
  const [playlistId, setPlaylistId] = useState("");

  const provinceName = (code: string) => {
    const p = provinces.find((x) => x.code === code);
    if (!p) return code;
    return locale === "km" ? p.nameKm : p.nameEn;
  };

  async function onLink(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await linkMusicAccount({
      serverUrl: formData.get("serverUrl"),
      username: formData.get("username"),
      password: formData.get("password"),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function onUnlink() {
    setSubmitting(true);
    await unlinkMusicAccount();
    setSubmitting(false);
    router.refresh();
  }

  async function loadPlaylists() {
    setPlaylistsError(null);
    const result = await getMyPlaylists();
    if (!result.ok) {
      setPlaylistsError(result.error);
      return;
    }
    setPlaylists(result.data.playlists);
  }

  async function onAddMapping() {
    const playlist = playlists?.find((p) => p.id === playlistId);
    if (!provinceCode || !playlist) return;
    setSubmitting(true);
    setError(null);
    const result = await setProvincePlaylist({
      provinceCode,
      playlistId: playlist.id,
      playlistName: playlist.name,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProvinceCode("");
    setPlaylistId("");
    router.refresh();
  }

  async function onRemoveMapping(code: string) {
    setSubmitting(true);
    await clearProvincePlaylist({ provinceCode: code });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Music className="size-4 text-mekong" strokeWidth={1.5} />
          {t("accountTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!linked ? (
          <form action={onLink} className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("linkPrompt")}</p>
            <div className="space-y-2">
              <Label htmlFor="music-server-url">{t("serverUrl")}</Label>
              <Input
                id="music-server-url"
                name="serverUrl"
                type="url"
                inputMode="url"
                placeholder="https://music.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-username">{t("username")}</Label>
              <Input id="music-username" name="username" autoComplete="off" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-password">{t("password")}</Label>
              <Input
                id="music-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">{t("passwordNotStored")}</p>
            </div>
            <Button size="sm" type="submit" disabled={submitting}>
              {submitting ? t("linking") : t("link")}
            </Button>
          </form>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("linkedAs", { username: username ?? "", server: serverUrl ?? "" })}
            </p>
            <Button variant="outline" size="sm" onClick={onUnlink} disabled={submitting}>
              {t("unlink")}
            </Button>

            <div className="space-y-2 border-t border-sandstone pt-4">
              <p className="text-sm font-medium">{t("mappingsTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("mappingsHint")}</p>

              {mappings.length > 0 && (
                <ul className="space-y-1">
                  {mappings.map((m) => (
                    <li key={m.provinceCode} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {provinceName(m.provinceCode)} → {m.playlistName}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("removeMapping")}
                        disabled={submitting}
                        onClick={() => onRemoveMapping(m.provinceCode)}
                      >
                        <X className="size-4" strokeWidth={1.5} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {playlists === null ? (
                <>
                  <Button variant="outline" size="sm" onClick={loadPlaylists}>
                    {t("addMapping")}
                  </Button>
                  {playlistsError && <p className="text-sm text-destructive">{playlistsError}</p>}
                </>
              ) : (
                <div className="space-y-2">
                  <Select value={provinceCode} onValueChange={(v) => setProvinceCode(v ?? "")}>
                    <SelectTrigger aria-label={t("province")}>
                      <SelectValue placeholder={t("province")} />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {locale === "km" ? p.nameKm : p.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={playlistId} onValueChange={(v) => setPlaylistId(v ?? "")}>
                    <SelectTrigger aria-label={t("playlist")}>
                      <SelectValue placeholder={t("playlist")} />
                    </SelectTrigger>
                    <SelectContent>
                      {playlists.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {playlists.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("noPlaylists")}</p>
                  )}
                  <Button
                    size="sm"
                    onClick={onAddMapping}
                    disabled={submitting || !provinceCode || !playlistId}
                  >
                    {t("saveMapping")}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { completeAgendaItem } from "@/lib/actions/agenda-items";
import type { DayRouteLeg } from "@/lib/actions/routing";
import type { ItemVoiceClips } from "@/lib/actions/voice";
import {
  etaSeconds,
  isOffRoute,
  nearestPointOnPolyline,
  remainingRouteMeters,
} from "@/lib/routing/follow";
import {
  INITIAL_ARRIVAL_STATE,
  updateArrival,
  type ArrivalState,
} from "@/lib/voice/arrival";
import { directionsUrl, haversineDistanceMeters, type LatLng } from "@/lib/trips/geo";
import { Button } from "@/components/ui/button";
import { LocateFixed, Navigation, PartyPopper, TriangleAlert } from "lucide-react";

/** Welcome audio: pre-generated clip → on-device Khmer/English speech →
 * chime + vibration. Never throws — arrival must always at least show the
 * banner. */
function playWelcome(clipUrl: string | null, text: string, locale: string) {
  try {
    if (clipUrl) {
      void new Audio(clipUrl).play().catch(() => playFallback(text, locale));
      return;
    }
    playFallback(text, locale);
  } catch {
    // Even the fallback failed — the banner alone is the welcome.
  }
}

function playFallback(text: string, locale: string) {
  const lang = locale === "km" ? "km-KH" : "en-US";
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.some((v) => v.lang.startsWith(lang.slice(0, 2)))) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  } else {
    chime();
  }
  navigator.vibrate?.([200, 100, 200]);
}

// "Fire once per stop per day" must survive a page reload mid-visit, so
// welcomed stop ids are kept in localStorage under today's date.
const WELCOMED_STORAGE_KEY = "tesajor-welcomed-stops";

function loadWelcomedToday(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WELCOMED_STORAGE_KEY) ?? "null");
    if (raw?.date === new Date().toDateString() && Array.isArray(raw.stopIds)) {
      return raw.stopIds;
    }
  } catch {
    // Corrupt/blocked storage — fall through to a fresh day.
  }
  return [];
}

function saveWelcomedToday(stopIds: string[]) {
  try {
    localStorage.setItem(
      WELCOMED_STORAGE_KEY,
      JSON.stringify({ date: new Date().toDateString(), stopIds }),
    );
  } catch {
    // Session-only memory still prevents repeats until reload.
  }
}

function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // No audio context — vibration/banner still happened.
  }
}

export interface FollowStop {
  id: string;
  title: string;
  status: "todo" | "done" | "skipped";
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  placeName: string | null;
  address: string | null;
}

interface Props {
  stops: FollowStop[];
  legs: DayRouteLeg[] | null;
  /** Lets the day map highlight the leg being traveled (null = none). */
  onCurrentLegChange?: (index: number | null) => void;
  /** Pre-generated welcome/reminder clips per agenda item (TC-4). */
  voiceClips?: Record<string, ItemVoiceClips>;
  voiceEnabled?: boolean;
  voiceLocale?: string;
  /** Show the quest-completion button on the arrival banner. */
  canComplete?: boolean;
}

/**
 * Follow-along companion for the passenger/planner view: live position →
 * next-stop card with remaining distance and ETA, and an off-route warning
 * that hands off to Google Maps. Voice turn-by-turn is deliberately out of
 * scope (see the trip-companion plan) — the Navigate button is the way to
 * actually drive a leg. All geometry comes from src/lib/routing/follow.ts.
 */
export function FollowMode({
  stops,
  legs,
  onCurrentLegChange,
  voiceClips,
  voiceEnabled = false,
  voiceLocale = "km",
  canComplete = false,
}: Props) {
  const t = useTranslations("routing");
  const tv = useTranslations("voice");
  const router = useRouter();
  const [watching, setWatching] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const arrivalRef = useRef<ArrivalState>(INITIAL_ARRIVAL_STATE);
  const [welcome, setWelcome] = useState<{ id: string; title: string } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const nextStop = stops.find(
    (s): s is FollowStop & { lat: number; lng: number } =>
      s.status === "todo" && s.lat != null && s.lng != null,
  );
  const legIndex = nextStop && legs ? legs.findIndex((l) => l.toId === nextStop.id) : -1;
  const leg = legIndex >= 0 ? legs![legIndex] : null;

  useEffect(() => {
    onCurrentLegChange?.(watching && legIndex >= 0 ? legIndex : null);
  }, [watching, legIndex, onCurrentLegChange]);

  // Arrival welcome: dwell inside the 100 m radius for 10 s → banner + one
  // spoken welcome (pure state machine in src/lib/voice/arrival.ts).
  useEffect(() => {
    if (!watching || !position || !nextStop) return;
    const { state, fired } = updateArrival(arrivalRef.current, {
      stopId: nextStop.id,
      distanceMeters: haversineDistanceMeters(position, nextStop),
      nowMs: Date.now(),
    });
    arrivalRef.current = state;
    if (fired) {
      saveWelcomedToday(state.firedStopIds);
      setWelcome({ id: nextStop.id, title: nextStop.title });
      setCompleted(false);
      if (voiceEnabled) {
        playWelcome(
          voiceClips?.[nextStop.id]?.welcomeUrl ?? null,
          tv("phraseWelcome", { place: nextStop.title }),
          voiceLocale,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, position, nextStop?.id]);

  async function completeStop() {
    if (!welcome) return;
    setCompleting(true);
    const result = await completeAgendaItem({ itemId: welcome.id });
    setCompleting(false);
    if (result.ok) {
      setCompleted(true);
      router.refresh();
    }
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function toggle() {
    if (watching) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
      setPosition(null);
      setWelcome(null);
      arrivalRef.current = INITIAL_ARRIVAL_STATE;
      return;
    }
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    setGeoError(false);
    arrivalRef.current = { ...INITIAL_ARRIVAL_STATE, firedStopIds: loadWelcomedToday() };
    setWatching(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setGeoError(true);
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );
  }

  const fmtDistance = (meters: number) =>
    meters < 1000
      ? t("distanceM", { distance: Math.round(meters / 10) * 10 })
      : t("distanceKm", { distance: (meters / 1000).toFixed(1) });

  // Remaining distance along the road when this leg has a route; straight
  // line otherwise (no ETA then — we don't know the road).
  let remaining: number | null = null;
  let eta: number | null = null;
  let offRoute = false;
  if (position && nextStop) {
    const points = leg?.route?.points;
    if (points) {
      const projection = nearestPointOnPolyline(position, points);
      if (projection) {
        remaining = remainingRouteMeters(points, projection);
        offRoute = isOffRoute(projection);
        eta = etaSeconds(remaining, leg!.route!.distanceMeters, leg!.route!.durationSec);
      }
    }
    if (remaining === null) {
      remaining = haversineDistanceMeters(position, nextStop);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant={watching ? "default" : "outline"} size="sm" onClick={toggle}>
        <LocateFixed className="size-4" strokeWidth={1.5} />
        {watching ? t("followStop") : t("followStart")}
      </Button>

      {geoError && <p className="text-sm text-muted-foreground">{t("geoDenied")}</p>}

      {welcome && (
        <div className="space-y-2 rounded-md border border-saffron bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <PartyPopper className="size-4 shrink-0 text-saffron" strokeWidth={1.5} />
            {tv("welcomeBanner", { place: welcome.title })}
          </p>
          {canComplete && !completed && (
            <Button size="sm" disabled={completing} onClick={completeStop}>
              {tv("completeStop")}
            </Button>
          )}
          {completed && <p className="text-sm text-muted-foreground">{tv("completed")}</p>}
        </div>
      )}

      {watching && !nextStop && (
        <p className="text-sm text-muted-foreground">{t("dayComplete")}</p>
      )}

      {watching && nextStop && !position && (
        <p className="text-sm text-muted-foreground">{t("locating")}</p>
      )}

      {watching && nextStop && position && remaining !== null && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-bold text-saffron">{t("nextStop")}</p>
          <p className="text-sm font-medium">{nextStop.title}</p>
          <p className="text-sm text-muted-foreground">
            {t("remaining", { distance: fmtDistance(remaining) })}
            {eta !== null && ` · ${t("eta", { minutes: Math.max(1, Math.round(eta / 60)) })}`}
          </p>
          {offRoute && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <TriangleAlert className="size-4 shrink-0" strokeWidth={1.5} />
              {t("offRoute")}
            </p>
          )}
          <a
            href={directionsUrl(nextStop)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2"
          >
            <Navigation className="size-4" strokeWidth={1.5} />
            {t("navigate")}
          </a>
        </div>
      )}
    </div>
  );
}

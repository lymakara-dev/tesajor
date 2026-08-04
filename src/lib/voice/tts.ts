/**
 * Text-to-speech behind a provider interface (mirrors the routing-provider
 * pattern, ADR-0010). Two hosted drivers with documented Khmer neural
 * voices — Azure Speech and Google Cloud TTS — selected by env
 * (`TTS_PROVIDER`, `TTS_API_KEY`, Azure also `TTS_REGION`). All optional:
 * no key → no clips are generated and the UI degrades to banner + chime.
 *
 * The provider bake-off from the trip-companion plan (open question 4) is
 * settled by configuration, not code: point the env at either provider,
 * generate the same phrase, and let a native speaker pick.
 *
 * Request construction and response parsing are pure and tested; the
 * fetchers are thin.
 */
import type { VoiceLocale } from "./phrases";

export const TTS_PROVIDERS = ["azure", "google"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];

export interface TtsConfig {
  provider: TtsProvider;
  apiKey: string;
  /** Azure only, e.g. "southeastasia". */
  region: string | null;
}

/** Documented neural voices per locale (Azure names). */
export const AZURE_VOICES: Record<VoiceLocale, string> = {
  km: "km-KH-SreymomNeural",
  en: "en-US-JennyNeural",
};

const LANGUAGE_CODES: Record<VoiceLocale, string> = {
  km: "km-KH",
  en: "en-US",
};

/** Read TTS config from env-like input; null when not (fully) configured. */
export function getTtsConfig(
  env: Record<string, string | undefined> = process.env,
): TtsConfig | null {
  const provider = env.TTS_PROVIDER;
  const apiKey = env.TTS_API_KEY;
  if (!apiKey || (provider !== "azure" && provider !== "google")) return null;
  const region = env.TTS_REGION ?? null;
  if (provider === "azure" && !region) return null;
  return { provider, apiKey, region };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function azureTtsUrl(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export function azureSsml(text: string, locale: VoiceLocale): string {
  const lang = LANGUAGE_CODES[locale];
  const voice = AZURE_VOICES[locale];
  return `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
}

export const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export function googleTtsBody(
  text: string,
  locale: VoiceLocale,
): { input: { text: string }; voice: { languageCode: string }; audioConfig: { audioEncoding: string } } {
  return {
    input: { text },
    voice: { languageCode: LANGUAGE_CODES[locale] },
    audioConfig: { audioEncoding: "MP3" },
  };
}

/** Google returns base64 MP3 in `audioContent`. */
export function parseGoogleAudio(json: unknown): Buffer {
  const audioContent = (json as { audioContent?: string })?.audioContent;
  if (!audioContent) throw new Error("No audio in response");
  return Buffer.from(audioContent, "base64");
}

const FETCH_TIMEOUT_MS = 10_000;

/** Synthesize a phrase to MP3 bytes. Throws on failure — callers treat a
 * missing clip as "silent mode", never as a user-facing error. */
export async function synthesize(
  text: string,
  locale: VoiceLocale,
  config: TtsConfig,
): Promise<Buffer> {
  if (config.provider === "azure") {
    const res = await fetch(azureTtsUrl(config.region!), {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: azureSsml(text, locale),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Azure TTS returned ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  const res = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(config.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(googleTtsBody(text, locale)),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google TTS returned ${res.status}`);
  return parseGoogleAudio(await res.json());
}
